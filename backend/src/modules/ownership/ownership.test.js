import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { ConflictError } from '../../utils/app-error.js';
import {
  ErrorEnvelopeSchema,
  OwnedPropertyDetailSchema,
  OwnedPropertyListResponseSchema,
  OwnershipResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';
import { createOwnership, updateOwnership } from './ownership.service.js';

/**
 * Unit coverage for the share-percentage cap (Section 11.1), plus
 * integration coverage for `/me/properties`, `/me/properties/:id`,
 * `/properties/:id/ownerships` and `/ownerships/:id` (Section 5.2). Fixtures
 * are created directly through Prisma with a `wp5-` prefix and torn down in
 * `afterAll`, per the environment notes — seeded rows are never touched.
 */

const createdUserIds = [];
const createdPropertyIds = [];

const createTestUser = async (overrides = {}) => {
  const user = await prisma.user.create({
    data: {
      email: `wp5-ownership-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-these-tests',
      fullName: 'WP5 Ownership Test User',
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
      slug: `wp5-ownership-${randomUUID()}`,
      title: 'WP5 ownership test plot',
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

const createTestOwnership = async ({ propertyId, ownerUserId, sharePercentage }) =>
  prisma.ownership.create({
    data: { propertyId, ownerUserId, sharePercentage },
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
});

describe('the share-percentage cap (unit)', () => {
  it('rejects a create that would push the total past 100%', async () => {
    const property = await createTestProperty();
    const first = await createTestUser();
    const second = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: first.id, sharePercentage: '60.00' });

    await expect(
      createOwnership({ propertyId: property.id, ownerUserId: second.id, sharePercentage: '50.00' }),
    ).rejects.toThrow(ConflictError);
  });

  it('allows a create that lands exactly on 100%', async () => {
    const property = await createTestProperty();
    const first = await createTestUser();
    const second = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: first.id, sharePercentage: '60.00' });

    const created = await createOwnership({
      propertyId: property.id,
      ownerUserId: second.id,
      sharePercentage: '40.00',
    });

    expect(created.sharePercentage).toBe('40');
  });

  it('rejects recording the same person twice on one property', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id, sharePercentage: '50.00' });

    await expect(
      createOwnership({ propertyId: property.id, ownerUserId: owner.id, sharePercentage: '10.00' }),
    ).rejects.toThrow(ConflictError);
  });

  it('excludes the row being updated from its own sum', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const other = await createTestUser();
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '60.00',
    });
    await createTestOwnership({ propertyId: property.id, ownerUserId: other.id, sharePercentage: '30.00' });

    // 60% -> 70% is fine: the other owner's 30% plus the *new* 70% is
    // exactly 100%, which only works if the row's own old 60% is excluded
    // from the sum it is being compared against.
    const updated = await updateOwnership({ id: ownership.id, sharePercentage: '70.00' });
    expect(updated.sharePercentage).toBe('70');
  });

  it('rejects an update that would push the total past 100%', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const other = await createTestUser();
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '60.00',
    });
    await createTestOwnership({ propertyId: property.id, ownerUserId: other.id, sharePercentage: '30.00' });

    await expect(updateOwnership({ id: ownership.id, sharePercentage: '80.00' })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('GET /me/properties', () => {
  it("returns only the caller's own holdings", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const property = await createTestProperty();
    const otherProperty = await createTestProperty();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id, sharePercentage: '100.00' });
    await createTestOwnership({ propertyId: otherProperty.id, ownerUserId: other.id, sharePercentage: '100.00' });

    const res = await request(app).get('/api/v1/me/properties').set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(
      paginatedEnvelope(OwnedPropertyListResponseSchema.element).safeParse(res.body).success,
    ).toBe(true);
    expect(OwnedPropertyListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.some((row) => row.property.id === property.id)).toBe(true);
    expect(res.body.data.some((row) => row.property.id === otherProperty.id)).toBe(false);
  });

  it('401s an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/me/properties');
    expect(res.status).toBe(401);
  });
});

describe('GET /me/properties/:id', () => {
  it("returns the caller's ownership row plus every share on the plot", async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const coOwner = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id, sharePercentage: '40.00' });
    await createTestOwnership({ propertyId: property.id, ownerUserId: coOwner.id, sharePercentage: '60.00' });

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(successEnvelope(OwnedPropertyDetailSchema).safeParse(res.body).success).toBe(true);
    expect(OwnedPropertyDetailSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.ownership.ownerUserId).toBe(owner.id);
    expect(res.body.data.ownerships).toHaveLength(2);
  });

  it("403s a signed-in user who does not own the property, rather than 404-leaking it", async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const intruder = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id, sharePercentage: '100.00' });

    const res = await request(app)
      .get(`/api/v1/me/properties/${property.id}`)
      .set(authHeader(intruder));

    expect(res.status).toBe(403);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('404s for a property that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .get(`/api/v1/me/properties/${randomUUID()}`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const res = await request(app).get(`/api/v1/me/properties/${property.id}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /properties/:id/ownerships', () => {
  it('lets an agent record an ownership share', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/ownerships`)
      .set(authHeader(agent))
      .send({ ownerUserId: owner.id, sharePercentage: '55.00', documentRef: 'DEED-1' });

    expect(res.status).toBe(201);
    expect(successEnvelope(OwnershipResponseSchema).safeParse(res.body).success).toBe(true);
    expect(OwnershipResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.sharePercentage).toBe('55');
    expect(res.body.data.ownerUser.id).toBe(owner.id);
  });

  it('404s for a property that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const owner = await createTestUser();
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/ownerships`)
      .set(authHeader(agent))
      .send({ ownerUserId: owner.id });

    expect(res.status).toBe(404);
  });

  it('409s when the share cap would be exceeded', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const first = await createTestUser();
    const second = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: first.id, sharePercentage: '70.00' });

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/ownerships`)
      .set(authHeader(agent))
      .send({ ownerUserId: second.id, sharePercentage: '40.00' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('409s a duplicate owner on the same property', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const owner = await createTestUser();
    await createTestOwnership({ propertyId: property.id, ownerUserId: owner.id, sharePercentage: '50.00' });

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/ownerships`)
      .set(authHeader(agent))
      .send({ ownerUserId: owner.id, sharePercentage: '10.00' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const owner = await createTestUser();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/ownerships`)
      .set(authHeader(subscriber))
      .send({ ownerUserId: owner.id });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/ownerships`)
      .send({ ownerUserId: owner.id });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /ownerships/:id', () => {
  it('lets an agent update an ownership record', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '50.00',
    });

    const res = await request(app)
      .patch(`/api/v1/ownerships/${ownership.id}`)
      .set(authHeader(agent))
      .send({ sharePercentage: '75.00', notes: 'Confirmed by registry copy.' });

    expect(res.status).toBe(200);
    expect(OwnershipResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.sharePercentage).toBe('75');
    expect(res.body.data.notes).toBe('Confirmed by registry copy.');
  });

  it('404s for an ownership record that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .patch(`/api/v1/ownerships/${randomUUID()}`)
      .set(authHeader(agent))
      .send({ notes: 'x' });

    expect(res.status).toBe(404);
  });

  it('409s when the update would exceed the share cap', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const owner = await createTestUser();
    const other = await createTestUser();
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '50.00',
    });
    await createTestOwnership({ propertyId: property.id, ownerUserId: other.id, sharePercentage: '40.00' });

    const res = await request(app)
      .patch(`/api/v1/ownerships/${ownership.id}`)
      .set(authHeader(agent))
      .send({ sharePercentage: '70.00' });

    expect(res.status).toBe(409);
  });

  it('403s a subscriber', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '50.00',
    });

    const res = await request(app)
      .patch(`/api/v1/ownerships/${ownership.id}`)
      .set(authHeader(owner))
      .send({ notes: 'x' });

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '50.00',
    });

    const res = await request(app).patch(`/api/v1/ownerships/${ownership.id}`).send({ notes: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /ownerships/:id', () => {
  it('lets an admin delete an ownership record', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const admin = await createTestUser({ role: 'ADMIN' });
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '50.00',
    });

    const res = await request(app)
      .delete(`/api/v1/ownerships/${ownership.id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(204);
    expect(await prisma.ownership.findUnique({ where: { id: ownership.id } })).toBeNull();
  });

  it('404s for an ownership record that does not exist', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const res = await request(app)
      .delete(`/api/v1/ownerships/${randomUUID()}`)
      .set(authHeader(admin));

    expect(res.status).toBe(404);
  });

  it('403s an agent (admin only)', async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const ownership = await createTestOwnership({
      propertyId: property.id,
      ownerUserId: owner.id,
      sharePercentage: '50.00',
    });

    const res = await request(app)
      .delete(`/api/v1/ownerships/${ownership.id}`)
      .set(authHeader(agent));

    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const res = await request(app).delete(`/api/v1/ownerships/${randomUUID()}`);
    expect(res.status).toBe(401);
  });
});
