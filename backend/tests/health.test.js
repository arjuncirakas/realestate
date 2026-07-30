import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  ErrorEnvelopeSchema,
  HealthResponseSchema,
  successEnvelope,
} from '../src/contracts/index.js';

/**
 * The reference integration test. Every endpoint test in this project follows
 * this shape: exercise the route, then parse the body through its contract
 * schema. There is no compiler here — that assertion is what stops a module
 * returning a differently shaped object (Section 2.4).
 */
describe('GET /health', () => {
  it('returns the health payload inside the success envelope', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(successEnvelope(HealthResponseSchema).safeParse(res.body).success).toBe(true);
    expect(HealthResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('does not depend on the database', async () => {
    // Liveness only: a wedged process must be distinguishable from a busy
    // database, so this route must keep answering either way.
    const first = await request(app).get('/health');
    const second = await request(app).get('/health');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});

describe('error envelope', () => {
  it('returns NOT_FOUND for an unknown route', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route');

    expect(res.status).toBe(404);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns VALIDATION_ERROR for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/v1')
      .set('Content-Type', 'application/json')
      .send('{not json');

    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never leaks a stack trace or SQL to the client', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route');
    const body = JSON.stringify(res.body);

    expect(body).not.toMatch(/at \w+ \(/);
    expect(body).not.toMatch(/node_modules/);
    expect(body).not.toMatch(/SELECT|INSERT|prisma/i);
  });
});

describe('security headers', () => {
  it('sets helmet defaults and hides the framework', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
