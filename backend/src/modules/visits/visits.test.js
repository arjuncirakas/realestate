import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { ValidationError } from '../../utils/app-error.js';
import {
  ErrorEnvelopeSchema,
  MySiteVisitListResponseSchema,
  SiteVisitListResponseSchema,
  SiteVisitResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';
import { assertPreferredDateNotInThePast } from './visits.service.js';

/**
 * Unit coverage for the "not in the past" business rule (Section 11.1), plus
 * integration coverage for `/properties/:id/site-visits`, `/site-visits` and
 * `/me/site-visits` (Section 5.2). Fixtures are created directly through
 * Prisma with a `wp4-` prefix and torn down in `afterAll`.
 */

const createdUserIds = [];
const createdPropertyIds = [];

const createTestUser = async (overrides = {}) => {
  const user = await prisma.user.create({
    data: {
      email: `wp4-visits-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-these-tests',
      fullName: 'WP4 Visits Test User',
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
      slug: `wp4-visits-${randomUUID()}`,
      title: 'WP4 visits test plot',
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

/** `YYYY-MM-DD` a fixed number of days from today (UTC), for building fixtures. */
const isoDateOffset = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

afterAll(async () => {
  await prisma.property.deleteMany({ where: { id: { in: createdPropertyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('assertPreferredDateNotInThePast (unit)', () => {
  it('accepts today and any future date', () => {
    expect(() => assertPreferredDateNotInThePast(isoDateOffset(0))).not.toThrow();
    expect(() => assertPreferredDateNotInThePast(isoDateOffset(30))).not.toThrow();
  });

  it('rejects yesterday with a field-level ValidationError', () => {
    expect(() => assertPreferredDateNotInThePast(isoDateOffset(-1))).toThrow(ValidationError);
    try {
      assertPreferredDateNotInThePast(isoDateOffset(-1));
    } catch (error) {
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details[0].field).toBe('preferredDate');
    }
  });
});

describe('POST /properties/:id/site-visits', () => {
  it('books a visit request as REQUESTED', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(10), preferredSlot: 'MORNING' });

    expect(res.status).toBe(201);
    expect(successEnvelope(SiteVisitResponseSchema).safeParse(res.body).success).toBe(true);
    expect(SiteVisitResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('REQUESTED');
    expect(res.body.data.userId).toBe(subscriber.id);
  });

  it('returns 400 for a preferred date in the past', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(-2), preferredSlot: 'MORNING' });

    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a property that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(10), preferredSlot: 'MORNING' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without a session', async () => {
    const property = await createTestProperty();
    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .send({ preferredDate: isoDateOffset(10), preferredSlot: 'MORNING' });
    expect(res.status).toBe(401);
  });
});

describe('GET /me/site-visits', () => {
  it("returns only the caller's own requests", async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const other = await createTestUser();

    await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'AFTERNOON' });
    await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(other))
      .send({ preferredDate: isoDateOffset(6), preferredSlot: 'EVENING' });

    const res = await request(app)
      .get('/api/v1/me/site-visits')
      .query({ propertyId: property.id })
      .set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(
      paginatedEnvelope(MySiteVisitListResponseSchema.element).safeParse(res.body).success,
    ).toBe(true);
    expect(MySiteVisitListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(subscriber.id);
  });

  it('omits agentNotes even after the visit has been annotated by an agent', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });
    await request(app)
      .patch(`/api/v1/site-visits/${created.body.data.id}`)
      .set(authHeader(agent))
      .send({ status: 'CONFIRMED', agentNotes: 'Internal note about access.' });

    const res = await request(app).get('/api/v1/me/site-visits').set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(MySiteVisitListResponseSchema.safeParse(res.body.data).success).toBe(true);
    const row = res.body.data.find((item) => item.id === created.body.data.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('agentNotes');
    expect(row.confirmedAt).not.toBeNull();
  });
});

describe('PATCH /me/site-visits/:id/cancel', () => {
  it('lets the owner cancel their own request', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });

    const res = await request(app)
      .patch(`/api/v1/me/site-visits/${created.body.data.id}/cancel`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(SiteVisitResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it("returns 403 for someone else's request rather than 404-leaking it", async () => {
    const property = await createTestProperty();
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(owner))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });

    const res = await request(app)
      .patch(`/api/v1/me/site-visits/${created.body.data.id}/cancel`)
      .set(authHeader(intruder));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for a request that does not exist', async () => {
    const subscriber = await createTestUser();
    const res = await request(app)
      .patch(`/api/v1/me/site-visits/${randomUUID()}/cancel`)
      .set(authHeader(subscriber));
    expect(res.status).toBe(404);
  });

  it('returns 409 when the request is already cancelled', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });

    await request(app)
      .patch(`/api/v1/me/site-visits/${created.body.data.id}/cancel`)
      .set(authHeader(subscriber));
    const res = await request(app)
      .patch(`/api/v1/me/site-visits/${created.body.data.id}/cancel`)
      .set(authHeader(subscriber));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /site-visits', () => {
  it('lists visits for an agent', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });

    const res = await request(app)
      .get('/api/v1/site-visits')
      .query({ propertyId: property.id })
      .set(authHeader(agent));

    expect(res.status).toBe(200);
    expect(SiteVisitListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 403 for a subscriber', async () => {
    const subscriber = await createTestUser();
    const res = await request(app).get('/api/v1/site-visits').set(authHeader(subscriber));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /site-visits/:id', () => {
  it('lets an agent confirm a visit and stamps confirmedAt', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });

    const res = await request(app)
      .patch(`/api/v1/site-visits/${created.body.data.id}`)
      .set(authHeader(agent))
      .send({ status: 'CONFIRMED', agentNotes: 'Confirmed for 9am.' });

    expect(res.status).toBe(200);
    expect(SiteVisitResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.confirmedAt).not.toBeNull();
  });

  it('returns 404 for a visit that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .patch(`/api/v1/site-visits/${randomUUID()}`)
      .set(authHeader(agent))
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for a subscriber', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/site-visits`)
      .set(authHeader(subscriber))
      .send({ preferredDate: isoDateOffset(5), preferredSlot: 'MORNING' });

    const res = await request(app)
      .patch(`/api/v1/site-visits/${created.body.data.id}`)
      .set(authHeader(subscriber))
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });
});
