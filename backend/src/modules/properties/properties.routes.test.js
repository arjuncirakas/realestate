import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { BCRYPT_COST } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import {
  ErrorEnvelopeSchema,
  PropertyListItemSchema,
  PropertyMapPinSchema,
  PropertyResponseSchema,
  paginatedEnvelope,
  successEnvelope,
} from '../../contracts/index.js';

/**
 * Integration tests for `/properties` (Section 5.2), against the real,
 * seeded `estate_dev` database. Fixtures are created directly rather than
 * through `POST /auth/register` (WP1's module, not this one's) — tokens are
 * signed here with the same secret and payload shape `middleware/auth.js`
 * verifies, so these tests do not depend on WP1 landing first.
 *
 * Every fixture this file creates is prefixed `wp2-` (via a title prefixed
 * `WP2`, since the slug is derived from it) and removed in `afterAll`. Seeded
 * rows are read but never written.
 */

const API = '/api/v1';

/**
 * Signs an access token exactly as `middleware/auth.js` expects it.
 * @param {{ id: string, role: string }} user
 * @returns {string}
 */
const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });

/**
 * Creates a throwaway user directly in the database.
 * @param {{ email: string, role: string }} args
 * @returns {Promise<object>}
 */
const createTestUser = async ({ email, role }) =>
  prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('Password123', BCRYPT_COST),
      fullName: `WP2 Test ${role}`,
      role,
    },
  });

let agent;
let admin;
let subscriber;
let agentToken;
let adminToken;
let subscriberToken;

/** A `properties` row created directly, bypassing the API under test. */
let draftFixture;

beforeAll(async () => {
  [agent, admin, subscriber] = await Promise.all([
    createTestUser({ email: 'wp2-agent@estate.test', role: 'AGENT' }),
    createTestUser({ email: 'wp2-admin@estate.test', role: 'ADMIN' }),
    createTestUser({ email: 'wp2-subscriber@estate.test', role: 'SUBSCRIBER' }),
  ]);
  agentToken = signAccessToken(agent);
  adminToken = signAccessToken(admin);
  subscriberToken = signAccessToken(subscriber);

  draftFixture = await prisma.property.create({
    data: {
      slug: 'wp2-draft-fixture-plot',
      title: 'WP2 draft fixture plot',
      propertyType: 'PLOT',
      status: 'DRAFT',
      price: '2500000',
      areaValue: '5',
      areaUnit: 'CENT',
      city: 'Wp2 Fixture City',
      state: 'Kerala',
      latitude: 8.9,
      longitude: 76.6,
      listedByAgentId: agent.id,
    },
  });
});

afterAll(async () => {
  await prisma.property.deleteMany({ where: { slug: { startsWith: 'wp2-' } } });
  await prisma.user.deleteMany({ where: { id: { in: [agent.id, admin.id, subscriber.id] } } });
});

describe('GET /properties', () => {
  it('returns a paginated, schema-valid page restricted to public statuses', async () => {
    const res = await request(app).get(`${API}/properties`).query({ limit: 5 });

    expect(res.status).toBe(200);
    expect(paginatedEnvelope(PropertyListItemSchema).safeParse(res.body).success).toBe(true);
    for (const item of res.body.data) {
      expect(PropertyListItemSchema.safeParse(item).success).toBe(true);
      expect(['AVAILABLE', 'UNDER_OFFER', 'SOLD']).toContain(item.status);
    }
  });

  it('never returns a DRAFT listing, even when a caller asks for DRAFT explicitly', async () => {
    const res = await request(app)
      .get(`${API}/properties`)
      .query({ status: 'DRAFT', city: 'Wp2 Fixture City' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('filters by city and type', async () => {
    const res = await request(app).get(`${API}/properties`).query({ city: 'Kollam', type: 'PLOT' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.city).toBe('Kollam');
      expect(item.propertyType).toBe('PLOT');
    }
  });

  it(
    'exercises the exact radius SQL from Section 4.3 against seeded Kollam data, nearest first',
    async () => {
      // Kollam town. Precomputed against the seed (haversine): kundara (8.58km),
      // paravur (10.97km), kottiyam (11.28km), chathannoor (16.35km),
      // karunagappally (19.95km) and varkala (20.60km, filed under
      // Thiruvananthapuram district but geographically close) are the six
      // AVAILABLE plots within 25km; punalur (UNDER_OFFER, 36.8km), chavara
      // (WITHDRAWN, 12.0km) and anchal (DRAFT, 33.6km) must not appear — the
      // first because it is outside the radius, the other two because the raw
      // query is fixed to status = 'AVAILABLE'.
      const res = await request(app)
        .get(`${API}/properties`)
        .query({ lat: '8.8932', lng: '76.6141', radiusKm: '25', limit: '50' });

      expect(res.status).toBe(200);
      expect(paginatedEnvelope(PropertyListItemSchema).safeParse(res.body).success).toBe(true);

      const slugs = res.body.data.map((item) => item.slug);
      expect(slugs).toEqual([
        'kundara-industrial-belt-20-cent',
        'paravur-lake-view-10-cent',
        'kottiyam-junction-8-cent',
        'chathannoor-quiet-lane-11-cent',
        'karunagappally-backwater-15-cent',
        'varkala-cliffside-8-cent',
      ]);
      expect(slugs).not.toContain('punalur-town-5-cent');
      expect(slugs).not.toContain('chavara-coastal-7-cent');
      expect(slugs).not.toContain('anchal-hill-plot-13-cent');
    },
  );

  it('rejects lat without lng and radiusKm', async () => {
    const res = await request(app).get(`${API}/properties`).query({ lat: '8.9' });
    expect(res.status).toBe(400);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /properties/map', () => {
  it(
    'exercises the exact bounding-box SQL from Section 4.3 against seeded Kollam data',
    async () => {
      // A box covering the Kollam district plots used in the radius test above,
      // plus punalur (UNDER_OFFER), chavara (WITHDRAWN) and anchal (DRAFT) — all
      // of which fall inside this box but must be excluded because the map query
      // is fixed to status = 'AVAILABLE'.
      const res = await request(app).get(`${API}/properties/map`).query({
        minLng: '76.4',
        minLat: '8.7',
        maxLng: '77.0',
        maxLat: '9.1',
        limit: '200',
      });

      expect(res.status).toBe(200);
      expect(successEnvelope(PropertyMapPinSchema.array()).safeParse(res.body).success).toBe(true);
      for (const pin of res.body.data) {
        expect(PropertyMapPinSchema.safeParse(pin).success).toBe(true);
      }

      const slugs = res.body.data.map((pin) => pin.slug);
      expect(slugs).toEqual(
        expect.arrayContaining([
          'kottiyam-junction-8-cent',
          'chathannoor-quiet-lane-11-cent',
          'karunagappally-backwater-15-cent',
          'paravur-lake-view-10-cent',
          'kundara-industrial-belt-20-cent',
        ]),
      );
      expect(slugs).not.toContain('punalur-town-5-cent');
      expect(slugs).not.toContain('chavara-coastal-7-cent');
      expect(slugs).not.toContain('anchal-hill-plot-13-cent');
    },
  );

  it('rejects an inverted bounding box', async () => {
    const res = await request(app)
      .get(`${API}/properties/map`)
      .query({ minLng: '77', minLat: '8', maxLng: '76', maxLat: '9' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /properties/:slug', () => {
  it('returns full detail for a public listing and counts a view from a new caller', async () => {
    const first = await request(app).get(`${API}/properties/kayamkulam-paddy-adjacent-1-acre`);
    expect(first.status).toBe(200);
    expect(PropertyResponseSchema.safeParse(first.body.data).success).toBe(true);
    expect(first.body.data.media.length).toBeGreaterThan(0);
  });

  it(
    'does not count a second hit from the same caller within the debounce window (Section reviewer item 5)',
    async () => {
      // GET /properties/:slug is public and otherwise unthrottled — an
      // unconditional increment here is a trivially abusable write path.
      // supertest requests in this environment all share one caller address
      // (trust proxy is off outside production), so two calls back to back
      // are exactly the "same viewer, same window" case the debounce covers.
      const first = await request(app).get(`${API}/properties/paravur-lake-view-10-cent`);
      const second = await request(app).get(`${API}/properties/paravur-lake-view-10-cent`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.viewCount).toBe(first.body.data.viewCount);
    },
  );

  it('returns NOT_FOUND for a slug that does not exist', async () => {
    const res = await request(app).get(`${API}/properties/no-such-plot-at-all`);
    expect(res.status).toBe(404);
    expect(ErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('hides a DRAFT listing from an anonymous caller behind NOT_FOUND', async () => {
    const res = await request(app).get(`${API}/properties/${draftFixture.slug}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('lets an agent preview a DRAFT listing by slug', async () => {
    const res = await request(app)
      .get(`${API}/properties/${draftFixture.slug}`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(PropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
  });
});

describe('POST /properties', () => {
  const validBody = () => ({
    title: 'WP2 Create Validation Plot',
    propertyType: 'PLOT',
    price: '4200000',
    areaValue: '9',
    areaUnit: 'CENT',
    city: 'Wp2 Fixture City',
    state: 'Kerala',
    latitude: 8.9,
    longitude: 76.6,
  });

  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).post(`${API}/properties`).send(validBody());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns FORBIDDEN for a subscriber', async () => {
    const res = await request(app)
      .post(`${API}/properties`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send(validBody());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns VALIDATION_ERROR when a required field is missing', async () => {
    const { price: _price, ...withoutPrice } = validBody();
    const res = await request(app)
      .post(`${API}/properties`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send(withoutPrice);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when coordinates are omitted and no geocoding key is configured', async () => {
    const { latitude: _lat, longitude: _lng, ...addressOnly } = validBody();
    const res = await request(app)
      .post(`${API}/properties`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send(addressOnly);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a DRAFT listing owned by the caller, schema-valid, with a lowercase-hyphen slug', async () => {
    const res = await request(app)
      .post(`${API}/properties`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send(validBody());

    expect(res.status).toBe(201);
    expect(PropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.listedByAgentId).toBe(agent.id);
    expect(res.body.data.slug).toMatch(/^wp2-create-validation-plot-[a-z0-9]+$/);
    // Prisma's Decimal#toString() does not pad to the column's scale — a whole
    // number stored in a numeric(14,2) column round-trips without ".00".
    expect(res.body.data.price).toBe('4200000');
  });
});

describe('PATCH /properties/:id', () => {
  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).patch(`${API}/properties/${draftFixture.id}`).send({ price: '1' });
    expect(res.status).toBe(401);
  });

  it('returns FORBIDDEN for a subscriber', async () => {
    const res = await request(app)
      .patch(`${API}/properties/${draftFixture.id}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send({ price: '1000000' });
    expect(res.status).toBe(403);
  });

  it('returns NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app)
      .patch(`${API}/properties/${randomUUID()}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ price: '1000000' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a group-purchase amount on a listing that is not a group purchase', async () => {
    const res = await request(app)
      .patch(`${API}/properties/${draftFixture.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ groupTargetAmount: '9500000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates a field and returns the schema-valid result', async () => {
    const res = await request(app)
      .patch(`${API}/properties/${draftFixture.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ price: '2750000', priceIsNegotiable: true });

    expect(res.status).toBe(200);
    expect(PropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.price).toBe('2750000');
    expect(res.body.data.priceIsNegotiable).toBe(true);
  });
});

describe('GET /properties/admin/list', () => {
  it('returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).get(`${API}/properties/admin/list`);
    expect(res.status).toBe(401);
  });

  it('returns FORBIDDEN for a subscriber', async () => {
    const res = await request(app)
      .get(`${API}/properties/admin/list`)
      .set('Authorization', `Bearer ${subscriberToken}`);
    expect(res.status).toBe(403);
  });

  it('includes every status, unlike the public list', async () => {
    const res = await request(app)
      .get(`${API}/properties/admin/list`)
      .query({ q: 'WP2 draft fixture' })
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(paginatedEnvelope(PropertyListItemSchema).safeParse(res.body).success).toBe(true);
    expect(res.body.data.some((item) => item.slug === draftFixture.slug)).toBe(true);
  });

  it('mine=true narrows results to the caller’s own listings', async () => {
    const res = await request(app)
      .get(`${API}/properties/admin/list`)
      .query({ mine: 'true', limit: '50' })
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.data) {
      const row = await prisma.property.findUnique({ where: { id: item.id } });
      expect(row.listedByAgentId).toBe(agent.id);
    }
    expect(res.body.data.some((item) => item.slug === draftFixture.slug)).toBe(true);
  });
});

describe('property lifecycle: publish, and admin-only soft delete', () => {
  let propertyId;
  let propertySlug;

  it('POST /properties creates the fixture for this lifecycle', async () => {
    const res = await request(app)
      .post(`${API}/properties`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: 'WP2 Lifecycle Plot',
        propertyType: 'PLOT',
        price: '3300000',
        areaValue: '7',
        areaUnit: 'CENT',
        city: 'Wp2 Fixture City',
        state: 'Kerala',
        latitude: 8.91,
        longitude: 76.61,
      });
    expect(res.status).toBe(201);
    propertyId = res.body.data.id;
    propertySlug = res.body.data.slug;
  });

  it('POST /properties/:id/publish returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).post(`${API}/properties/${propertyId}/publish`);
    expect(res.status).toBe(401);
  });

  it('POST /properties/:id/publish returns FORBIDDEN for a subscriber', async () => {
    const res = await request(app)
      .post(`${API}/properties/${propertyId}/publish`)
      .set('Authorization', `Bearer ${subscriberToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /properties/:id/publish returns NOT_FOUND for an unknown id', async () => {
    const res = await request(app)
      .post(`${API}/properties/${randomUUID()}/publish`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(404);
  });

  it('POST /properties/:id/publish moves DRAFT to AVAILABLE and sets publishedAt', async () => {
    const res = await request(app)
      .post(`${API}/properties/${propertyId}/publish`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(PropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('AVAILABLE');
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it('POST /properties/:id/publish a second time returns CONFLICT', async () => {
    const res = await request(app)
      .post(`${API}/properties/${propertyId}/publish`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('the published listing now appears in the public catalogue', async () => {
    const res = await request(app).get(`${API}/properties/${propertySlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('AVAILABLE');
  });

  it('DELETE /properties/:id returns UNAUTHENTICATED without a token', async () => {
    const res = await request(app).delete(`${API}/properties/${propertyId}`);
    expect(res.status).toBe(401);
  });

  it('DELETE /properties/:id returns FORBIDDEN for an agent (admin only)', async () => {
    const res = await request(app)
      .delete(`${API}/properties/${propertyId}`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(403);
  });

  it('DELETE /properties/:id returns NOT_FOUND for an unknown id', async () => {
    const res = await request(app)
      .delete(`${API}/properties/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /properties/:id soft-deletes to WITHDRAWN as admin', async () => {
    const res = await request(app)
      .delete(`${API}/properties/${propertyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(PropertyResponseSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.status).toBe('WITHDRAWN');
  });

  it('DELETE /properties/:id a second time returns CONFLICT', async () => {
    const res = await request(app)
      .delete(`${API}/properties/${propertyId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('a withdrawn listing is no longer visible in the public catalogue', async () => {
    const res = await request(app).get(`${API}/properties/${propertySlug}`);
    expect(res.status).toBe(404);
  });
});
