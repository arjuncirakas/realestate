import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { resetRateLimiters } from '../../middleware/rate-limit.js';
import { AuthResponseSchema, ErrorEnvelopeSchema, MeResponseSchema, successEnvelope } from '../../contracts/index.js';

/**
 * Integration coverage for `/auth/*` (Section 5.2), exercised over HTTP via
 * supertest. Every success body is asserted against its contract schema
 * (Section 2.4) — that assertion is mandatory, not optional.
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

/** Registers a fixture subscriber over HTTP and tracks it for cleanup. */
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

/** Extracts the refresh-token cookie's `name=value` pair from a Set-Cookie header. */
const refreshCookiePair = (res) => {
  const cookie = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refreshToken='));
  return cookie?.split(';')[0];
};

describe('POST /auth/register', () => {
  it('creates an account and returns tokens in the success envelope', async () => {
    const res = await registerFixture('register');

    expect(res.status).toBe(201);
    expect(successEnvelope(AuthResponseSchema).safeParse(res.body).success).toBe(true);
    expect(AuthResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.user.role).toBe('SUBSCRIBER');
    // The refresh token is never in the body — only the cookie.
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    expect(refreshCookiePair(res)).toBeDefined();
    expect(res.headers['set-cookie'].join(';')).toMatch(/HttpOnly/);
  });

  it('returns VALIDATION_ERROR for a password that fails the policy', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: makeEmail('register-weak'), password: 'short', fullName: 'Weak Password' });

    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns CONFLICT for an email already registered', async () => {
    const email = makeEmail('register-conflict');
    const first = await registerFixture('register-conflict', { email });
    expect(first.status).toBe(201);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123', fullName: 'Second Claimant' });

    expect(res.status).toBe(409);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /auth/login', () => {
  it('returns tokens for correct credentials', async () => {
    const email = makeEmail('login');
    await registerFixture('login', { email });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });

    expect(res.status).toBe(200);
    expect(AuthResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(refreshCookiePair(res)).toBeDefined();
  });

  it('returns UNAUTHENTICATED for a wrong password', async () => {
    const email = makeEmail('login-bad');
    await registerFixture('login-bad', { email });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns UNAUTHENTICATED for a deactivated account', async () => {
    const email = makeEmail('login-deactivated');
    const registered = await registerFixture('login-deactivated', { email });
    await prisma.user.update({ where: { id: registered.body.data.user.id }, data: { isActive: false } });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the cookie and returns a new session', async () => {
    const registered = await registerFixture('refresh');
    const cookie = refreshCookiePair(registered);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(AuthResponseSchema.safeParse(res.body.data).success).toBe(true);
    const newCookie = refreshCookiePair(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(cookie);
  });

  it('returns UNAUTHENTICATED when no token is presented', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns UNAUTHENTICATED for a token that has already been rotated', async () => {
    const registered = await registerFixture('refresh-reuse');
    const cookie = refreshCookiePair(registered);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /auth/logout', () => {
  it('returns UNAUTHENTICATED without an access token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('revokes the session so the old refresh cookie stops working', async () => {
    const registered = await registerFixture('logout');
    const cookie = refreshCookiePair(registered);
    const { accessToken } = registered.body.data;

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie)
      .send({});

    // No response schema is defined for logout (docs/API.md 9.1) — only the
    // envelope shape applies.
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(res.body.meta).toEqual({});

    const refreshAttempt = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshAttempt.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it("returns the caller's own profile", async () => {
    const registered = await registerFixture('me');
    const { accessToken } = registered.body.data;

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(MeResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.id).toBe(registered.body.data.user.id);
  });
});

describe('PATCH /auth/me', () => {
  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).patch('/api/v1/auth/me').send({ fullName: 'Someone Else' });
    expect(res.status).toBe(401);
  });

  it('returns VALIDATION_ERROR for an empty body', async () => {
    const registered = await registerFixture('me-empty');
    const { accessToken } = registered.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates the full name', async () => {
    const registered = await registerFixture('me-update');
    const { accessToken } = registered.body.data;

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Renamed Subscriber' });

    expect(res.status).toBe(200);
    expect(MeResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.fullName).toBe('Renamed Subscriber');
  });
});
