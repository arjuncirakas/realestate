import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import {
  SavedPropertyListResponseSchema,
  SavedPropertyResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';
import { saveProperty } from './saved.service.js';

/**
 * Unit coverage for the idempotent save rule (Section 11.1), plus integration
 * coverage for `/me/saved` (Section 5.2). Fixtures are created directly
 * through Prisma with a `wp4-` prefix and torn down in `afterAll`.
 */

const createdUserIds = [];
const createdPropertyIds = [];

const createTestUser = async (overrides = {}) => {
  const user = await prisma.user.create({
    data: {
      email: `wp4-saved-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-these-tests',
      fullName: 'WP4 Saved Test User',
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
      slug: `wp4-saved-${randomUUID()}`,
      title: 'WP4 saved test plot',
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

describe('saveProperty idempotency (unit)', () => {
  it('saving the same plot twice leaves exactly one row', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    await saveProperty({ userId: subscriber.id, propertyId: property.id });
    await saveProperty({ userId: subscriber.id, propertyId: property.id });

    const count = await prisma.savedProperty.count({
      where: { userId: subscriber.id, propertyId: property.id },
    });
    expect(count).toBe(1);
  });
});

describe('GET /me/saved', () => {
  it("lists the caller's saved plots, most recent first, inside a paginated envelope", async () => {
    const subscriber = await createTestUser();
    const propertyA = await createTestProperty();
    const propertyB = await createTestProperty();

    await request(app).post(`/api/v1/me/saved/${propertyA.id}`).set(authHeader(subscriber));
    await request(app).post(`/api/v1/me/saved/${propertyB.id}`).set(authHeader(subscriber));

    const res = await request(app).get('/api/v1/me/saved').set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(
      paginatedEnvelope(SavedPropertyListResponseSchema.element).safeParse(res.body).success,
    ).toBe(true);
    expect(SavedPropertyListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].propertyId).toBe(propertyB.id);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('paginates with page and limit', async () => {
    const subscriber = await createTestUser();
    const properties = await Promise.all([
      createTestProperty(),
      createTestProperty(),
      createTestProperty(),
    ]);
    // Sequential, not Promise.all: `createdAt` ordering (used for the default
    // sort) must be deterministic across the three saves.
    for (const property of properties) {
      await request(app).post(`/api/v1/me/saved/${property.id}`).set(authHeader(subscriber));
    }

    const firstPage = await request(app)
      .get('/api/v1/me/saved')
      .query({ page: 1, limit: 2 })
      .set(authHeader(subscriber));
    const secondPage = await request(app)
      .get('/api/v1/me/saved')
      .query({ page: 2, limit: 2 })
      .set(authHeader(subscriber));

    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('rejects a limit above the 50 cap', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .get('/api/v1/me/saved')
      .query({ limit: 51 })
      .set(authHeader(subscriber));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/v1/me/saved');
    expect(res.status).toBe(401);
  });

  it('skips correctly onto page 2 against more than 20 saved rows, using the default limit', async () => {
    const subscriber = await createTestUser();
    const properties = await Promise.all(
      Array.from({ length: 21 }, () => createTestProperty()),
    );
    // `createMany` rather than 21 round trips through the route: the point of
    // this test is the skip/take arithmetic against a real >20 total, not the
    // save flow itself (already covered above).
    await prisma.savedProperty.createMany({
      data: properties.map((property, index) => ({
        userId: subscriber.id,
        propertyId: property.id,
        createdAt: new Date(Date.now() + index * 1000),
      })),
    });

    const firstPage = await request(app).get('/api/v1/me/saved').set(authHeader(subscriber));
    const secondPage = await request(app)
      .get('/api/v1/me/saved')
      .query({ page: 2 })
      .set(authHeader(subscriber));

    expect(firstPage.body.meta).toEqual({ page: 1, limit: 20, total: 21, totalPages: 2 });
    expect(firstPage.body.data).toHaveLength(20);
    expect(secondPage.body.meta).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
    expect(secondPage.body.data).toHaveLength(1);
  });
});

describe('POST /me/saved/:propertyId', () => {
  it('saves a plot', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    const res = await request(app).post(`/api/v1/me/saved/${property.id}`).set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(successEnvelope(SavedPropertyResponseSchema).safeParse(res.body).success).toBe(true);
    expect(SavedPropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toEqual({
      userId: subscriber.id,
      propertyId: property.id,
      createdAt: expect.any(String),
    });
  });

  it('succeeds again on an already-saved plot instead of conflicting', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    await request(app).post(`/api/v1/me/saved/${property.id}`).set(authHeader(subscriber));
    const res = await request(app).post(`/api/v1/me/saved/${property.id}`).set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(SavedPropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
  });

  it('returns 404 for a property that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .post(`/api/v1/me/saved/${randomUUID()}`)
      .set(authHeader(subscriber));
    expect(res.status).toBe(404);
  });

  it('returns 401 without a session', async () => {
    const property = await createTestProperty();
    const res = await request(app).post(`/api/v1/me/saved/${property.id}`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /me/saved/:propertyId', () => {
  it('removes a saved plot', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();
    await request(app).post(`/api/v1/me/saved/${property.id}`).set(authHeader(subscriber));

    const res = await request(app)
      .delete(`/api/v1/me/saved/${property.id}`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(SavedPropertyResponseSchema.safeParse(res.body.data).success).toBe(true);

    const remaining = await prisma.savedProperty.count({
      where: { userId: subscriber.id, propertyId: property.id },
    });
    expect(remaining).toBe(0);
  });

  it('returns 404 for a plot that was never saved', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    const res = await request(app)
      .delete(`/api/v1/me/saved/${property.id}`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(404);
  });

  it('returns 401 without a session', async () => {
    const property = await createTestProperty();
    const res = await request(app).delete(`/api/v1/me/saved/${property.id}`);
    expect(res.status).toBe(401);
  });
});
