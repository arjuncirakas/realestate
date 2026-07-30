import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { storage } from '../../services/storage.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import {
  ErrorEnvelopeSchema,
  ManagementLogListResponseSchema,
  ManagementLogResponseSchema,
  PlotSnapshotListResponseSchema,
  PlotSnapshotResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';
import { listPropertyLogsForOwner } from './logs.service.js';

/**
 * Unit coverage for the owner log-visibility rule (Section 11.1), plus
 * integration coverage for `/me/properties/:id/logs`,
 * `/me/properties/:id/snapshots`, `/properties/:id/logs`, `/logs/:id`,
 * `/logs/:id/media` and `/properties/:id/snapshots` (Section 5.2). Fixtures
 * are created directly through Prisma with a `wp5-` prefix and torn down in
 * `afterAll` — seeded rows are never touched.
 */

const createdUserIds = [];
const createdPropertyIds = [];
const storedKeysToClean = [];

const createTestUser = async (overrides = {}) => {
  const user = await prisma.user.create({
    data: {
      email: `wp5-logs-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-these-tests',
      fullName: 'WP5 Logs Test User',
      role: 'SUBSCRIBER',
      ...overrides,
    },
  });
  createdUserIds.push(user.id);
  return user;
};

const createTestProperty = async (overrides = {}) => {
  const property = await prisma.property.create({
    data: {
      slug: `wp5-logs-${randomUUID()}`,
      title: 'WP5 logs test plot',
      propertyType: 'PLOT',
      status: 'AVAILABLE',
      price: '1000000',
      areaValue: '10',
      areaUnit: 'CENT',
      city: 'Test City',
      state: 'Test State',
      latitude: 8.5,
      longitude: 76.9,
      ...overrides,
    },
  });
  createdPropertyIds.push(property.id);
  return property;
};

const createTestOwnership = async ({ propertyId, ownerUserId, sharePercentage = '100.00' }) =>
  prisma.ownership.create({ data: { propertyId, ownerUserId, sharePercentage } });

const createTestLog = async ({ propertyId, agentId, isVisibleToOwner = true, ...overrides }) =>
  prisma.managementLog.create({
    data: {
      propertyId,
      agentId,
      logType: 'INSPECTION',
      title: 'WP5 test log entry',
      occurredOn: new Date('2026-06-01T00:00:00.000Z'),
      isVisibleToOwner,
      ...overrides,
    },
  });

const authHeader = (user) => ({
  Authorization: `Bearer ${jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  })}`,
});

afterAll(async () => {
  await prisma.property.deleteMany({ where: { id: { in: createdPropertyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await Promise.all(storedKeysToClean.map((key) => storage.remove(key)));
});

describe('log visibility for owners (unit)', () => {
  it('never returns a hidden log to a subscriber owner', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const owner = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: true, title: 'Visible entry' });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: false, title: 'Hidden entry' });

    const { rows } = await listPropertyLogsForOwner({
      propertyId: property.id,
      userId: owner.id,
      page: 1,
      limit: 20,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Visible entry');
  });

  it('never returns a hidden log to an AGENT or ADMIN caller who is also recorded as an owner — Section 5.2 is unconditional here', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    await createTestOwnership({ propertyId: property.id, ownerUserId: agent.id });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: true, title: 'Visible entry' });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: false, title: 'Hidden entry' });

    const { rows } = await listPropertyLogsForOwner({
      propertyId: property.id,
      userId: agent.id,
      page: 1,
      limit: 20,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Visible entry');
  });

  it('403s a caller who does not own the property', async () => {
    const property = await createTestProperty();
    const intruder = await createTestUser();

    await expect(
      listPropertyLogsForOwner({
        propertyId: property.id,
        userId: intruder.id,
        page: 1,
        limit: 20,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('404s a property that does not exist', async () => {
    const subscriber = await createTestUser();

    await expect(
      listPropertyLogsForOwner({
        propertyId: randomUUID(),
        userId: subscriber.id,
        page: 1,
        limit: 20,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('GET /me/properties/:id/logs', () => {
  it('excludes hidden logs from the owner view', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const owner = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: true, title: 'Visible entry' });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: false, title: 'Hidden entry' });

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}/logs`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(
      paginatedEnvelope(ManagementLogListResponseSchema.element).safeParse(res.body).success,
    ).toBe(true);
    expect(ManagementLogListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Visible entry');
  });

  it('excludes hidden logs even for an AGENT/ADMIN caller who is also recorded as an owner', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    await createTestOwnership({ propertyId: property.id, ownerUserId: agent.id });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: true, title: 'Visible entry' });
    await createTestLog({ propertyId: property.id, agentId: agent.id, isVisibleToOwner: false, title: 'Hidden entry' });

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}/logs`)
      .set(authHeader(agent));

    expect(res.status).toBe(200);
    expect(ManagementLogListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Visible entry');
  });

  it('403s a caller who does not own the property', async () => {
    const property = await createTestProperty();
    const intruder = await createTestUser();

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}/logs`)
      .set(authHeader(intruder));

    expect(res.status).toBe(403);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
  });

  it('404s for a property that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .get(`/api/v1/me/properties/${randomUUID()}/logs`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(404);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const res = await request(app).get(`/api/v1/me/properties/${property.id}/logs`);
    expect(res.status).toBe(401);
  });
});

describe('GET /me/properties/:id/snapshots', () => {
  it('returns the caller\'s snapshots newest first', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id });
    await prisma.plotSnapshot.create({
      data: {
        propertyId: property.id,
        capturedAt: new Date('2026-01-01T00:00:00.000Z'),
        storageKey: `wp5-logs/${randomUUID()}.jpg`,
        url: 'http://example.test/older.jpg',
        source: 'MANUAL',
      },
    });
    await prisma.plotSnapshot.create({
      data: {
        propertyId: property.id,
        capturedAt: new Date('2026-06-01T00:00:00.000Z'),
        storageKey: `wp5-logs/${randomUUID()}.jpg`,
        url: 'http://example.test/newer.jpg',
        source: 'MANUAL',
      },
    });

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}/snapshots`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(PlotSnapshotListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].url).toBe('http://example.test/newer.jpg');
  });

  it('403s a caller who does not own the property', async () => {
    const property = await createTestProperty();
    const intruder = await createTestUser();

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}/snapshots`)
      .set(authHeader(intruder));

    expect(res.status).toBe(403);
  });

  it('404s for a property that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .get(`/api/v1/me/properties/${randomUUID()}/snapshots`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(404);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const res = await request(app).get(`/api/v1/me/properties/${property.id}/snapshots`);
    expect(res.status).toBe(401);
  });
});

describe('POST /properties/:id/logs', () => {
  it('lets an agent record a management log', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/logs`)
      .set(authHeader(agent))
      .send({ logType: 'MAINTENANCE', title: 'Cleared undergrowth', occurredOn: '2026-07-01' });

    expect(res.status).toBe(201);
    expect(successEnvelope(ManagementLogResponseSchema).safeParse(res.body).success).toBe(true);
    expect(ManagementLogResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.isVisibleToOwner).toBe(true);
    expect(res.body.data.agent.id).toBe(agent.id);
  });

  it('404s for a property that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/logs`)
      .set(authHeader(agent))
      .send({ logType: 'MAINTENANCE', title: 'Cleared undergrowth', occurredOn: '2026-07-01' });

    expect(res.status).toBe(404);
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/logs`)
      .set(authHeader(subscriber))
      .send({ logType: 'MAINTENANCE', title: 'Cleared undergrowth', occurredOn: '2026-07-01' });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/logs`)
      .send({ logType: 'MAINTENANCE', title: 'Cleared undergrowth', occurredOn: '2026-07-01' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /logs/:id', () => {
  it('lets an agent update a management log', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const log = await createTestLog({ propertyId: property.id, agentId: agent.id });

    const res = await request(app)
      .patch(`/api/v1/logs/${log.id}`)
      .set(authHeader(agent))
      .send({ isVisibleToOwner: false, notes: 'Boundary dispute pending resolution.' });

    expect(res.status).toBe(200);
    expect(ManagementLogResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.isVisibleToOwner).toBe(false);
    expect(res.body.data.notes).toBe('Boundary dispute pending resolution.');
  });

  it('404s for a log that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .patch(`/api/v1/logs/${randomUUID()}`)
      .set(authHeader(agent))
      .send({ notes: 'x' });

    expect(res.status).toBe(404);
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const subscriber = await createTestUser();
    const log = await createTestLog({ propertyId: property.id, agentId: agent.id });

    const res = await request(app)
      .patch(`/api/v1/logs/${log.id}`)
      .set(authHeader(subscriber))
      .send({ notes: 'x' });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const log = await createTestLog({ propertyId: property.id, agentId: agent.id });

    const res = await request(app).patch(`/api/v1/logs/${log.id}`).send({ notes: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('POST /logs/:id/media', () => {
  it('attaches files and returns the log with its media', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const log = await createTestLog({ propertyId: property.id, agentId: agent.id });

    const res = await request(app)
      .post(`/api/v1/logs/${log.id}/media`)
      .set(authHeader(agent))
      .field('caption', 'Boundary marker photo')
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'marker.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(ManagementLogResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.media).toHaveLength(1);
    expect(res.body.data.media[0].caption).toBe('Boundary marker photo');
    expect(res.body.data.media.every((item) => !('storageKey' in item))).toBe(true);

    const stored = await prisma.managementLogMedia.findFirst({ where: { logId: log.id } });
    storedKeysToClean.push(stored.storageKey);
  });

  it('404s for a log that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .post(`/api/v1/logs/${randomUUID()}/media`)
      .set(authHeader(agent))
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'marker.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const subscriber = await createTestUser();
    const log = await createTestLog({ propertyId: property.id, agentId: agent.id });

    const res = await request(app)
      .post(`/api/v1/logs/${log.id}/media`)
      .set(authHeader(subscriber))
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'marker.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const log = await createTestLog({ propertyId: property.id, agentId: agent.id });

    const res = await request(app)
      .post(`/api/v1/logs/${log.id}/media`)
      .attach('files', Buffer.from('jpeg-bytes'), { filename: 'marker.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });
});

describe('POST /properties/:id/snapshots', () => {
  it('lets an agent upload a plot snapshot', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/snapshots`)
      .set(authHeader(agent))
      .attach('file', Buffer.from('jpeg-bytes'), { filename: 'site.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(successEnvelope(PlotSnapshotResponseSchema).safeParse(res.body).success).toBe(true);
    expect(PlotSnapshotResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.source).toBe('MANUAL');
    expect(res.body.data).not.toHaveProperty('storageKey');

    const stored = await prisma.plotSnapshot.findUnique({ where: { id: res.body.data.id } });
    storedKeysToClean.push(stored.storageKey);
  });

  it('404s for a property that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/snapshots`)
      .set(authHeader(agent))
      .attach('file', Buffer.from('jpeg-bytes'), { filename: 'site.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/snapshots`)
      .set(authHeader(subscriber))
      .attach('file', Buffer.from('jpeg-bytes'), { filename: 'site.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/snapshots`)
      .attach('file', Buffer.from('jpeg-bytes'), { filename: 'site.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });
});
