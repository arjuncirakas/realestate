import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { resetRateLimiters } from '../../middleware/rate-limit.js';
import {
  EnquiryListResponseSchema,
  EnquiryResponseSchema,
  ErrorEnvelopeSchema,
  MyEnquiryListResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';

/**
 * Integration coverage for `/properties/:id/enquiries`, `/enquiries` and
 * `/me/enquiries` (Section 5.2), plus the guest-enquiry attribution rule
 * (Section 4.2). Fixtures are created directly through Prisma with a `wp4-`
 * prefix and torn down in `afterAll`; seeded rows are never touched.
 */

const createdUserIds = [];
const createdPropertyIds = [];

const createTestUser = async (overrides = {}) => {
  const user = await prisma.user.create({
    data: {
      email: `wp4-enquiries-${randomUUID()}@example.test`,
      passwordHash: 'not-used-in-these-tests',
      fullName: 'WP4 Enquiries Test User',
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
      slug: `wp4-enquiries-${randomUUID()}`,
      title: 'WP4 enquiries test plot',
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

/** Mints an access token directly, so these tests do not depend on the auth module's login flow. */
const authHeader = (user) => ({
  Authorization: `Bearer ${jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  })}`,
});

afterAll(async () => {
  // Deleting the properties cascades their enquiries (Section 4.2 FK cascade).
  await prisma.property.deleteMany({ where: { id: { in: createdPropertyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

beforeEach(async () => {
  await resetRateLimiters();
});

describe('POST /properties/:id/enquiries', () => {
  it('accepts a guest enquiry with no userId', async () => {
    const property = await createTestProperty();

    const res = await request(app).post(`/api/v1/properties/${property.id}/enquiries`).send({
      name: 'Guest Visitor',
      email: 'guest@example.test',
      message: 'Is the survey sketch available for this plot?',
    });

    expect(res.status).toBe(201);
    expect(successEnvelope(EnquiryResponseSchema).safeParse(res.body).success).toBe(true);
    expect(EnquiryResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.userId).toBeNull();
    expect(res.body.data.status).toBe('NEW');
    expect(res.body.data.assignedAgent).toBeNull();
  });

  it('attributes the enquiry to a signed-in visitor', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/enquiries`)
      .set(authHeader(subscriber))
      .send({
        name: 'Signed In Visitor',
        email: 'signedin@example.test',
        message: 'Can I get the boundary survey for this plot?',
      });

    expect(res.status).toBe(201);
    expect(EnquiryResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.userId).toBe(subscriber.id);
  });

  it('returns 404 for a property that does not exist', async () => {
    const res = await request(app)
      .post(`/api/v1/properties/${randomUUID()}/enquiries`)
      .send({
        name: 'Guest Visitor',
        email: 'guest@example.test',
        message: 'Does this plot still exist on the market?',
      });

    expect(res.status).toBe(404);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for an invalid body', async () => {
    const property = await createTestProperty();

    const res = await request(app).post(`/api/v1/properties/${property.id}/enquiries`).send({
      name: 'A',
      email: 'not-an-email',
      message: 'short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /me/enquiries', () => {
  it('returns only the caller\'s own enquiries', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const otherSubscriber = await createTestUser();

    await request(app).post(`/api/v1/properties/${property.id}/enquiries`).set(authHeader(subscriber)).send({
      name: 'Mine',
      email: 'mine@example.test',
      message: 'This enquiry belongs to the first subscriber.',
    });
    await request(app)
      .post(`/api/v1/properties/${property.id}/enquiries`)
      .set(authHeader(otherSubscriber))
      .send({
        name: 'Not mine',
        email: 'notmine@example.test',
        message: 'This enquiry belongs to a different subscriber.',
      });

    const res = await request(app)
      .get('/api/v1/me/enquiries')
      .query({ propertyId: property.id })
      .set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(
      paginatedEnvelope(MyEnquiryListResponseSchema.element).safeParse(res.body).success,
    ).toBe(true);
    expect(MyEnquiryListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(subscriber.id);
  });

  it('omits the agent triage fields even after the enquiry has been triaged', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const agent = await createTestUser({ role: 'AGENT' });
    const created = await request(app)
      .post(`/api/v1/properties/${property.id}/enquiries`)
      .set(authHeader(subscriber))
      .send({
        name: 'Triaged Visitor',
        email: 'triaged@example.test',
        message: 'Please confirm the boundary survey is available.',
      });
    await request(app)
      .patch(`/api/v1/enquiries/${created.body.data.id}`)
      .set(authHeader(agent))
      .send({ status: 'CONTACTED', assignedAgentId: agent.id, agentNotes: 'Internal note.' });

    const res = await request(app).get('/api/v1/me/enquiries').set(authHeader(subscriber));

    expect(res.status).toBe(200);
    expect(MyEnquiryListResponseSchema.safeParse(res.body.data).success).toBe(true);
    const row = res.body.data.find((item) => item.id === created.body.data.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('agentNotes');
    expect(row).not.toHaveProperty('assignedAgentId');
    expect(row).not.toHaveProperty('assignedAgent');
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/v1/me/enquiries');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /enquiries', () => {
  it('lists enquiries for an agent', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    await request(app).post(`/api/v1/properties/${property.id}/enquiries`).send({
      name: 'Queue Visitor',
      email: 'queue@example.test',
      message: 'Please tell me the pincode for this plot.',
    });

    const res = await request(app)
      .get('/api/v1/enquiries')
      .query({ propertyId: property.id })
      .set(authHeader(agent));

    expect(res.status).toBe(200);
    expect(EnquiryListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 403 for a subscriber', async () => {
    const subscriber = await createTestUser();
    const res = await request(app).get('/api/v1/enquiries').set(authHeader(subscriber));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/v1/enquiries');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /enquiries/:id', () => {
  it('lets an agent triage an enquiry', async () => {
    const property = await createTestProperty();
    const agent = await createTestUser({ role: 'AGENT' });
    const created = await request(app).post(`/api/v1/properties/${property.id}/enquiries`).send({
      name: 'Triage Visitor',
      email: 'triage@example.test',
      message: 'Is town water connected to this plot already?',
    });

    const res = await request(app)
      .patch(`/api/v1/enquiries/${created.body.data.id}`)
      .set(authHeader(agent))
      .send({ status: 'CONTACTED', assignedAgentId: agent.id, agentNotes: 'Called on 30 July.' });

    expect(res.status).toBe(200);
    expect(EnquiryResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('CONTACTED');
    expect(res.body.data.assignedAgentId).toBe(agent.id);
    expect(res.body.data.assignedAgent).toEqual({ id: agent.id, fullName: agent.fullName });
  });

  it('returns 404 for an enquiry that does not exist', async () => {
    const agent = await createTestUser({ role: 'AGENT' });
    const res = await request(app)
      .patch(`/api/v1/enquiries/${randomUUID()}`)
      .set(authHeader(agent))
      .send({ status: 'CLOSED' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for a subscriber', async () => {
    const property = await createTestProperty();
    const subscriber = await createTestUser();
    const created = await request(app).post(`/api/v1/properties/${property.id}/enquiries`).send({
      name: 'Visitor',
      email: 'visitor@example.test',
      message: 'What is the load sanctioned for the connection here?',
    });

    const res = await request(app)
      .patch(`/api/v1/enquiries/${created.body.data.id}`)
      .set(authHeader(subscriber))
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(403);
  });
});
