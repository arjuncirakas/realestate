import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { resetRateLimiters } from '../../middleware/rate-limit.js';
import { PaginationMetaSchema, UserListResponseSchema, UserResponseSchema } from '../../contracts/index.js';

/**
 * Integration coverage for `/users/*` (Section 5.2, admin only). Uses the
 * seeded admin account to sign in — read-only against that row, never
 * modified — since role management can only be exercised by a real admin.
 */

const createdUserIds = [];
const makeEmail = (label) => `wp1-${label}-${randomUUID()}@example.test`;

afterAll(async () => {
  if (createdUserIds.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

beforeEach(async () => {
  await resetRateLimiters();
});

const registerFixture = async (label, overrides = {}) => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: makeEmail(label),
      password: 'Password123',
      fullName: 'Fixture Subscriber',
      ...overrides,
    });
  createdUserIds.push(res.body.data.user.id);
  return res;
};

/** Signs in as the seeded admin (Section 10) and returns its access token. */
const adminAccessToken = async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@estate.test', password: 'Password123' });
  return res.body.data.accessToken;
};

describe('GET /users', () => {
  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns FORBIDDEN for a signed-in subscriber', async () => {
    const registered = await registerFixture('users-list-forbidden');
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${registered.body.data.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns a paginated, contract-shaped list for an admin', async () => {
    const token = await adminAccessToken();
    const res = await request(app).get('/api/v1/users?limit=5').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(UserListResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(PaginationMetaSchema.safeParse(res.body.meta).success).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('filters by the q search term', async () => {
    const email = makeEmail('users-list-search');
    await registerFixture('users-list-search', { email, fullName: 'Findable Person' });
    const token = await adminAccessToken();

    const res = await request(app)
      .get(`/api/v1/users?q=${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((user) => user.email === email)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });
});

describe('PATCH /users/:id', () => {
  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).patch(`/api/v1/users/${randomUUID()}`).send({ isActive: false });
    expect(res.status).toBe(401);
  });

  it('returns FORBIDDEN for a signed-in subscriber', async () => {
    const registered = await registerFixture('users-patch-forbidden');
    const res = await request(app)
      .patch(`/api/v1/users/${registered.body.data.user.id}`)
      .set('Authorization', `Bearer ${registered.body.data.accessToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it('returns NOT_FOUND for an id that does not exist', async () => {
    const token = await adminAccessToken();
    const res = await request(app)
      .patch(`/api/v1/users/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns VALIDATION_ERROR for an empty body', async () => {
    const token = await adminAccessToken();
    const registered = await registerFixture('users-patch-empty');

    const res = await request(app)
      .patch(`/api/v1/users/${registered.body.data.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('deactivates a user and revokes their sessions', async () => {
    const token = await adminAccessToken();
    const registered = await registerFixture('users-patch-deactivate');
    const userId = registered.body.data.user.id;
    const cookie = (registered.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refreshToken='))
      ?.split(';')[0];

    const res = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(UserResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.isActive).toBe(false);

    const refreshAttempt = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshAttempt.status).toBe(401);
  });

  it('updates a role and revokes the user\'s sessions', async () => {
    const token = await adminAccessToken();
    const registered = await registerFixture('users-patch-role');
    const cookie = (registered.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refreshToken='))
      ?.split(';')[0];

    const res = await request(app)
      .patch(`/api/v1/users/${registered.body.data.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'AGENT' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('AGENT');

    const refreshAttempt = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshAttempt.status).toBe(401);
  });

  it('does not revoke sessions when the role is resubmitted unchanged', async () => {
    const token = await adminAccessToken();
    const registered = await registerFixture('users-patch-role-noop');
    const cookie = (registered.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refreshToken='))
      ?.split(';')[0];

    const res = await request(app)
      .patch(`/api/v1/users/${registered.body.data.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SUBSCRIBER' });

    expect(res.status).toBe(200);

    const refreshAttempt = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshAttempt.status).toBe(200);
  });
});
