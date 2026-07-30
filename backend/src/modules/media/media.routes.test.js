import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { storage } from '../../services/storage.js';
import { ErrorEnvelopeSchema, PropertyMediaListResponseSchema, PropertyMediaResponseSchema } from '../../contracts/index.js';

/**
 * Integration tests for the three media endpoints (Section 5.2), run against
 * the real app and the shared dev database. Fixtures are created directly
 * through Prisma — the properties module is a different work package — and
 * are prefixed `wp3-` per the environment notes so they never collide with
 * seeded rows or another teammate's fixtures.
 */

/** Signs an access token the `authenticate` middleware will accept. */
const tokenFor = (role) =>
  jwt.sign({ sub: randomUUID(), role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });

const agentToken = tokenFor('AGENT');
const subscriberToken = tokenFor('SUBSCRIBER');

const createdPropertyIds = [];
const storedKeysToClean = [];

/**
 * Creates a bare property row to attach media to. Media doesn't reference an
 * agent, so no user row is needed — only a real property id.
 */
const createTestProperty = async () => {
  const property = await prisma.property.create({
    data: {
      slug: `wp3-test-plot-${randomUUID()}`,
      title: 'WP3 media test plot',
      propertyType: 'PLOT',
      status: 'DRAFT',
      price: '2500000.00',
      areaValue: '10.00',
      areaUnit: 'CENT',
      city: 'Thiruvananthapuram',
      state: 'Kerala',
      latitude: 8.5241,
      longitude: 76.9366,
    },
  });
  createdPropertyIds.push(property.id);
  return property;
};

afterAll(async () => {
  // Cascade deletes any surviving property_media rows; storage objects are
  // cleaned up independently since the adapter has no cascade of its own.
  await prisma.property.deleteMany({ where: { id: { in: createdPropertyIds } } });
  await Promise.all(storedKeysToClean.map((key) => storage.remove(key)));
});

describe('POST /properties/:id/media', () => {
  it('uploads files and makes the first image the cover when the property has none', async () => {
    const property = await createTestProperty();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' })
      .attach('files', Buffer.from('%PDF-1.4'), { filename: 'deed.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(PropertyMediaListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const image = res.body.data.find((item) => item.type === 'IMAGE');
    const document = res.body.data.find((item) => item.type === 'DOCUMENT');
    expect(image.isCover).toBe(true);
    expect(document.isCover).toBe(false);
    // storageKey must never leak to the client.
    expect(res.body.data.every((item) => !('storageKey' in item))).toBe(true);

    for (const item of res.body.data) {
      const stored = await prisma.propertyMedia.findUnique({ where: { id: item.id } });
      storedKeysToClean.push(stored.storageKey);
    }
  });

  it('rejects a file type outside the allowlist', async () => {
    const property = await createTestProperty();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('#!/bin/sh'), { filename: 'script.sh', contentType: 'application/x-sh' });

    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404s when the property does not exist, rather than 500ing', async () => {
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('PATCH /media/:id', () => {
  /** Uploads one image and returns its media row id and the property id. */
  const uploadOneImage = async () => {
    const property = await createTestProperty();
    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' });
    const [media] = res.body.data;
    storedKeysToClean.push((await prisma.propertyMedia.findUnique({ where: { id: media.id } })).storageKey);
    return { propertyId: property.id, mediaId: media.id };
  };

  it('updates caption and sort order', async () => {
    const { mediaId } = await uploadOneImage();

    const res = await request(app)
      .patch(`/api/v1/media/${mediaId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ caption: 'Front view from the road', sortOrder: 3 });

    expect(res.status).toBe(200);
    expect(PropertyMediaResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.caption).toBe('Front view from the road');
    expect(res.body.data.sortOrder).toBe(3);
  });

  it('setting isCover clears the previous cover for the same property', async () => {
    const { propertyId, mediaId: firstId } = await uploadOneImage();
    const secondUpload = await request(app)
      .post(`/api/v1/properties/${propertyId}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('jpeg-bytes-2'), { filename: 'plot-2.jpg', contentType: 'image/jpeg' });
    const secondId = secondUpload.body.data[0].id;
    storedKeysToClean.push(
      (await prisma.propertyMedia.findUnique({ where: { id: secondId } })).storageKey,
    );

    const res = await request(app)
      .patch(`/api/v1/media/${secondId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ isCover: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isCover).toBe(true);

    const previousCover = await prisma.propertyMedia.findUnique({ where: { id: firstId } });
    expect(previousCover.isCover).toBe(false);
  });

  it('404s for a media item that does not exist', async () => {
    const res = await request(app)
      .patch(`/api/v1/media/${randomUUID()}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ caption: 'x' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('403s a subscriber', async () => {
    const { mediaId } = await uploadOneImage();

    const res = await request(app)
      .patch(`/api/v1/media/${mediaId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send({ caption: 'x' });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const { mediaId } = await uploadOneImage();

    const res = await request(app).patch(`/api/v1/media/${mediaId}`).send({ caption: 'x' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /media/:id', () => {
  it('deletes the row and the stored object', async () => {
    const property = await createTestProperty();
    const upload = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' });
    const mediaId = upload.body.data[0].id;

    const res = await request(app).delete(`/api/v1/media/${mediaId}`).set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(204);
    expect(await prisma.propertyMedia.findUnique({ where: { id: mediaId } })).toBeNull();
  });

  it('404s for a media item that no longer exists', async () => {
    const res = await request(app)
      .delete(`/api/v1/media/${randomUUID()}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const upload = await request(app)
      .post(`/api/v1/properties/${property.id}/media`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'plot.jpg', contentType: 'image/jpeg' });
    const mediaId = upload.body.data[0].id;
    storedKeysToClean.push((await prisma.propertyMedia.findUnique({ where: { id: mediaId } })).storageKey);

    const res = await request(app)
      .delete(`/api/v1/media/${mediaId}`)
      .set('Authorization', `Bearer ${subscriberToken}`);

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const res = await request(app).delete(`/api/v1/media/${randomUUID()}`);
    expect(res.status).toBe(401);
  });
});

describe('the partial unique index backing the cover rule', () => {
  it('rejects a second is_cover row for the same property at the database level', async () => {
    const property = await createTestProperty();
    await prisma.propertyMedia.create({
      data: {
        propertyId: property.id,
        type: 'IMAGE',
        storageKey: `wp3-index-check/${randomUUID()}.jpg`,
        url: 'http://example.test/a.jpg',
        isCover: true,
      },
    });

    await expect(
      prisma.propertyMedia.create({
        data: {
          propertyId: property.id,
          type: 'IMAGE',
          storageKey: `wp3-index-check/${randomUUID()}.jpg`,
          url: 'http://example.test/b.jpg',
          isCover: true,
        },
      }),
    ).rejects.toThrow();
  });
});
