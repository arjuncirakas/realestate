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
  InterestListResponseSchema,
  InterestResponseSchema,
  MyInterestListResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';
import { registerInterest, withdrawMyInterest } from './interests.service.js';

/**
 * Unit coverage for the one-registration-per-person-per-property rule
 * (Section 11.1), plus integration coverage for `/properties/:id/interest`,
 * `/interests` and `/me/interests` (Section 5.2). This is an
 * expression-of-interest register only (Section 1.3): fixtures and
 * assertions use the approved register-interest vocabulary throughout.
 * Fixtures are created directly through Prisma with a `wp4-` prefix and torn
 * down in `afterAll`.
 */

const createdUserIds = [];
const createdPropertyIds = [];

const createTestUser = async (overrides = {}) => {
  const user = await prisma.user.create({
    data: {
      email: `wp4-interests-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-these-tests',
      fullName: 'WP4 Interests Test User',
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
      slug: `wp4-interests-${randomUUID()}`,
      title: 'WP4 interests test plot',
      propertyType: 'PLOT',
      status: 'AVAILABLE',
      price: '1000000',
      areaValue: '10',
      areaUnit: 'CENT',
      city: 'Test City',
      state: 'Test State',
      latitude: 8.5,
      longitude: 76.9,
      isGroupPurchase: true,
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

describe('registerInterest one-per-property rule (unit)', () => {
  it('rejects a second registration by the same person on the same property', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    await registerInterest({
      propertyId: property.id,
      userId: subscriber.id,
      indicativeAmount: '500000',
      notes: 'Registering interest to learn more.',
    });

    await expect(
      registerInterest({ propertyId: property.id, userId: subscriber.id }),
    ).rejects.toThrow(ConflictError);
  });

  it('lets a withdrawn registration be reopened rather than locking the person out', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    const first = await registerInterest({
      propertyId: property.id,
      userId: subscriber.id,
      indicativeAmount: '500000',
      notes: 'First pass.',
    });
    await withdrawMyInterest({ id: first.id, userId: subscriber.id });

    const reopened = await registerInterest({
      propertyId: property.id,
      userId: subscriber.id,
      indicativeAmount: '650000',
      notes: 'Reconsidered — registering interest again.',
    });

    expect(reopened.id).toBe(first.id);
    expect(reopened.status).toBe('NEW');
    expect(reopened.indicativeAmount).toBe('650000');

    // The unique index on (propertyId, userId) means there can only ever be
    // one row for this pair — confirm re-registration reused it rather than
    // failing to insert a second one.
    const rows = await prisma.interestRegistration.findMany({
      where: { propertyId: property.id, userId: subscriber.id },
    });
    expect(rows).toHaveLength(1);
  });
});

describe('POST /properties/:id/interest', () => {
  it('registers an expression of interest', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({ indicativeAmount: '750000', notes: 'Please call after 6pm.' });

    expect(res.status).toBe(201);
    expect(successEnvelope(InterestResponseSchema).safeParse(res.body).success).toBe(true);
    expect(InterestResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('NEW');
    expect(res.body.data.indicativeAmount).toBe('750000');
  });

  it('returns 409 for a second registration on the same property', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();
    await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    expect(res.status).toBe(409);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 for a property that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/interest`)
      .set(authHeader(subscriber))
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 401 without a session', async () => {
    const property = await createTestProperty();
    const res = await request(app).post(`/api/v1/properties/${property.id}/interest`).send({});
    expect(res.status).toBe(401);
  });

  it('reopens a withdrawn registration as 201 rather than 409', async () => {
    const subscriber = await createTestUser();
    const property = await createTestProperty();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});
    await request(app)
      .patch(`/api/v1/me/interests/${created.body.data.id}/withdraw`)
      .set(authHeader(subscriber));

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({ indicativeAmount: '400000' });

    expect(res.status).toBe(201);
    expect(InterestResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.id).toBe(created.body.data.id);
    expect(res.body.data.status).toBe('NEW');
    expect(res.body.data.indicativeAmount).toBe('400000');
  });
});

describe('GET /me/interests', () => {
  it("returns only the caller's own registrations", async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const other = await createTestUser();

    await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});
    await request(app).post(`/api/v1/properties/${property.id}/interest`).set(authHeader(other)).send({});

    const res = await request(app)
      .get('/api/v1/me/interests')
      .query({ propertyId: property.id })
      .set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(
      paginatedEnvelope(MyInterestListResponseSchema.element).safeParse(res.body).success,
    ).toBe(true);
    expect(MyInterestListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(subscriber.id);
  });

  it('omits agentNotes even after an agent has followed up', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});
    await request(app)
      .patch(`/api/v1/interests/${created.body.data.id}`)
      .set(authHeader(agent))
      .send({ status: 'CONTACTED', agentNotes: 'Internal follow-up note.' });

    const res = await request(app).get('/api/v1/me/interests').set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(MyInterestListResponseSchema.safeParse(res.body.data).success).toBe(true);
    const row = res.body.data.find((item) => item.id === created.body.data.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('agentNotes');
    expect(row.status).toBe('CONTACTED');
  });
});

describe('PATCH /me/interests/:id/withdraw', () => {
  it('lets the owner withdraw their own registration', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    const res = await request(app)
      .patch(`/api/v1/me/interests/${created.body.data.id}/withdraw`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(InterestResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('WITHDRAWN');
  });

  it("returns 403 for someone else's registration rather than 404-leaking it", async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(owner))
      .send({});

    const res = await request(app)
      .patch(`/api/v1/me/interests/${created.body.data.id}/withdraw`)
      .set(authHeader(intruder));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for a registration that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .patch(`/api/v1/me/interests/${randomUUID()}/withdraw`)
      .set(authHeader(subscriber));
    expect(res.status).toBe(404);
  });

  it('returns 409 when the registration is already withdrawn', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    await request(app)
      .patch(`/api/v1/me/interests/${created.body.data.id}/withdraw`)
      .set(authHeader(subscriber));
    const res = await request(app)
      .patch(`/api/v1/me/interests/${created.body.data.id}/withdraw`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /interests', () => {
  it('lists registrations for an agent', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    const res = await request(app)
      .get('/api/v1/interests')
      .query({ propertyId: property.id })
      .set(authHeader(agent));

    expect(res.status).toBe(200);
    expect(InterestListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 403 for a subscriber', async () => {
    const subscriber = await createTestUser();
    const res = await request(app).get('/api/v1/interests').set(authHeader(subscriber));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /interests/:id', () => {
  it('lets an agent follow up on a registration', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    const res = await request(app)
      .patch(`/api/v1/interests/${created.body.data.id}`)
      .set(authHeader(agent))
      .send({ status: 'CONTACTED', agentNotes: 'Spoke on 30 July.' });

    expect(res.status).toBe(200);
    expect(InterestResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('CONTACTED');
    expect(res.body.data.agentNotes).toBe('Spoke on 30 July.');
  });

  it('returns 404 for a registration that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .patch(`/api/v1/interests/${randomUUID()}`)
      .set(authHeader(agent))
      .send({ status: 'CONTACTED' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for a subscriber', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/interest`)
      .set(authHeader(subscriber))
      .send({});

    const res = await request(app)
      .patch(`/api/v1/interests/${created.body.data.id}`)
      .set(authHeader(subscriber))
      .send({ status: 'CONTACTED' });

    expect(res.status).toBe(403);
  });
});
