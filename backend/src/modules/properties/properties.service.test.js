import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    property: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '../../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import {
  createProperty,
  getPropertyBySlug,
  listAdminProperties,
  listProperties,
  publishProperty,
  updateProperty,
  withdrawProperty,
} from './properties.service.js';

/**
 * Unit tests for the business rules that live in the service (Section 11.1):
 * publish/withdraw state transitions, the group-purchase pairing rule, and
 * geocoding being required when coordinates are absent and no API key is
 * configured. Prisma is mocked throughout — these tests never touch a
 * database or the network. Slug uniqueness itself is covered in
 * `properties.helpers.test.js`; the radius and bbox raw queries are covered
 * by integration tests against the seeded database.
 */

/** A Prisma `Decimal`-like value, since the real class is not needed for these assertions. */
const decimal = (value) => ({ toString: () => value });

/** A fully-populated detail row, the shape `serializeDetail` expects. */
const baseRow = (overrides = {}) => ({
  id: 'b6e2b7b0-2f6a-4b8e-9a3d-4b1a8c6f2e10',
  slug: 'wp2-test-slug-aaaaaaaa',
  title: 'Eight cent plot near Kottiyam junction',
  propertyType: 'PLOT',
  status: 'DRAFT',
  price: decimal('3900000.00'),
  priceIsNegotiable: false,
  areaValue: decimal('8.00'),
  areaUnit: 'CENT',
  locality: 'Kottiyam',
  city: 'Kollam',
  district: 'Kollam',
  state: 'Kerala',
  pincode: '691571',
  surveyNumber: '64/3',
  latitude: 8.848,
  longitude: 76.706,
  isGroupPurchase: false,
  groupTargetAmount: null,
  groupMinTicket: null,
  addressLine: null,
  description: null,
  amenities: [],
  listedByAgentId: 'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  listedByAgent: null,
  viewCount: 0,
  publishedAt: null,
  createdAt: new Date('2026-01-05T09:00:00.000Z'),
  updatedAt: new Date('2026-01-05T09:00:00.000Z'),
  media: [],
  ...overrides,
});

describe('publishProperty', () => {
  it('throws NotFoundError for an unknown id', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(null);
    await expect(publishProperty('missing-id')).rejects.toThrow(NotFoundError);
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the listing is not currently a draft', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ status: 'AVAILABLE' }));
    await expect(publishProperty('p1')).rejects.toThrow(ConflictError);
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it('moves a draft to AVAILABLE and sets publishedAt', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ status: 'DRAFT' }));
    prisma.property.update.mockResolvedValueOnce(
      baseRow({ status: 'AVAILABLE', publishedAt: new Date('2026-07-30T09:00:00.000Z') }),
    );

    const result = await publishProperty('p1');

    expect(prisma.property.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { status: 'AVAILABLE', publishedAt: expect.any(Date) },
      }),
    );
    expect(result.status).toBe('AVAILABLE');
    expect(result.publishedAt).toBe('2026-07-30T09:00:00.000Z');
  });
});

describe('withdrawProperty', () => {
  it('throws NotFoundError for an unknown id', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(null);
    await expect(withdrawProperty('missing-id')).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when the listing is already withdrawn', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ status: 'WITHDRAWN' }));
    await expect(withdrawProperty('p1')).rejects.toThrow(ConflictError);
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it('soft-deletes an available listing to WITHDRAWN', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ status: 'AVAILABLE' }));
    prisma.property.update.mockResolvedValueOnce(baseRow({ status: 'WITHDRAWN' }));

    const result = await withdrawProperty('p1');

    expect(prisma.property.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: { status: 'WITHDRAWN' } }),
    );
    expect(result.status).toBe('WITHDRAWN');
  });
});

describe('updateProperty — group-purchase pairing rule', () => {
  it('throws NotFoundError for an unknown id', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(null);
    await expect(updateProperty('missing-id', { price: '100' })).rejects.toThrow(NotFoundError);
  });

  it('rejects a group amount on a listing that is not, and is not becoming, a group purchase', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ isGroupPurchase: false }));
    await expect(
      updateProperty('p1', { groupTargetAmount: '9500000' }),
    ).rejects.toThrow(ValidationError);
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it('allows a group amount when the same patch also flips isGroupPurchase to true', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ isGroupPurchase: false }));
    prisma.property.update.mockResolvedValueOnce(
      baseRow({ isGroupPurchase: true, groupTargetAmount: decimal('9500000.00') }),
    );

    const result = await updateProperty('p1', {
      isGroupPurchase: true,
      groupTargetAmount: '9500000',
    });
    expect(result.groupTargetAmount).toBe('9500000.00');
  });

  it('allows a group amount on a listing already flagged as a group purchase', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow({ isGroupPurchase: true }));
    prisma.property.update.mockResolvedValueOnce(
      baseRow({ isGroupPurchase: true, groupTargetAmount: decimal('9500000.00') }),
    );

    await expect(
      updateProperty('p1', { groupTargetAmount: '9500000' }),
    ).resolves.toMatchObject({ groupTargetAmount: '9500000.00' });
  });

  it('clears stale group amounts when isGroupPurchase is turned off without also clearing them', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(
      baseRow({
        isGroupPurchase: true,
        groupTargetAmount: decimal('9500000.00'),
        groupMinTicket: decimal('950000.00'),
      }),
    );
    prisma.property.update.mockResolvedValueOnce(
      baseRow({ isGroupPurchase: false, groupTargetAmount: null, groupMinTicket: null }),
    );

    await updateProperty('p1', { isGroupPurchase: false });

    expect(prisma.property.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isGroupPurchase: false,
          groupTargetAmount: null,
          groupMinTicket: null,
        }),
      }),
    );
  });
});

describe('updateProperty — geocoding on an address change', () => {
  it('requires coordinates when an address field changes without them, and no geocoding key is configured', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow());

    // GEOCODING_API_KEY is unset in the test environment (tests/setup-env.js),
    // matching the lead decision that an unset key must fail loudly. No
    // network call happens on this path.
    await expect(updateProperty('p1', { locality: 'New Locality' })).rejects.toThrow(
      ValidationError,
    );
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it('does not attempt to geocode a patch that touches neither an address field nor coordinates', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow());
    prisma.property.update.mockResolvedValueOnce(baseRow({ price: decimal('4000000.00') }));

    await expect(updateProperty('p1', { price: '4000000' })).resolves.toMatchObject({
      price: '4000000.00',
    });
  });

  it('accepts a patch that supplies both coordinates directly, without geocoding', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(baseRow());
    prisma.property.update.mockResolvedValueOnce(baseRow({ latitude: 9.0, longitude: 76.9 }));

    await updateProperty('p1', { latitude: 9.0, longitude: 76.9 });

    expect(prisma.property.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ latitude: 9.0, longitude: 76.9 }) }),
    );
  });
});

describe('createProperty', () => {
  const actor = { id: 'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a', role: 'AGENT' };

  it('requires coordinates when none are supplied and no geocoding key is configured', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(null); // slug is free

    await expect(
      createProperty(
        {
          title: 'Ten cent plot near Technopark',
          propertyType: 'PLOT',
          price: '5800000',
          areaValue: '10',
          areaUnit: 'CENT',
          city: 'Thiruvananthapuram',
          state: 'Kerala',
        },
        actor,
      ),
    ).rejects.toThrow(ValidationError);
    expect(prisma.property.create).not.toHaveBeenCalled();
  });

  it('creates a DRAFT listing owned by the calling agent when coordinates are supplied', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(null); // slug is free
    prisma.property.create.mockResolvedValueOnce(
      baseRow({ status: 'DRAFT', listedByAgentId: actor.id }),
    );

    const result = await createProperty(
      {
        title: 'Eight cent plot near Kottiyam junction',
        propertyType: 'PLOT',
        price: '3900000',
        areaValue: '8',
        areaUnit: 'CENT',
        city: 'Kollam',
        state: 'Kerala',
        latitude: 8.848,
        longitude: 76.706,
      },
      actor,
    );

    expect(result.status).toBe('DRAFT');
    expect(prisma.property.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          listedByAgentId: actor.id,
          latitude: 8.848,
          longitude: 76.706,
        }),
      }),
    );
  });
});

describe('default sort matches the composite index', () => {
  it('the public catalogue orders "newest" by a plain publishedAt desc, not createdAt', async () => {
    prisma.property.findMany.mockResolvedValueOnce([]);
    prisma.property.count.mockResolvedValueOnce(0);

    await listProperties({ page: 1, limit: 20, sort: 'newest' });

    // The schema's only composite index is @@index([status, publishedAt(sort:
    // Desc)]) (Section 4.2), and Postgres's DESC implies NULLS FIRST — a plain
    // `desc` here matches that ordering exactly. The public catalogue never
    // shows a DRAFT, so publishedAt is never null and NULLS ordering never
    // applies on this path.
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { publishedAt: 'desc' } }),
    );
  });

  it('the admin list orders "newest" with nulls last, since a DRAFT has no publishedAt', async () => {
    prisma.property.findMany.mockResolvedValueOnce([]);
    prisma.property.count.mockResolvedValueOnce(0);

    await listAdminProperties(
      { page: 1, limit: 20, sort: 'newest' },
      { id: 'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a', role: 'AGENT' },
    );

    // Unlike the public catalogue, DRAFT rows appear here with a null
    // publishedAt — NULLS LAST keeps them at the end of a "newest first" list
    // instead of sorting to the top under Postgres's default NULLS FIRST. That
    // one extra Sort step is a deliberate trade against the public path.
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } } }),
    );
  });
});

describe('listProperties — radius search reports the true total, not a truncated candidate count', () => {
  it('total reflects every match, even beyond the old 500-row candidate cap', async () => {
    const manyIds = Array.from({ length: 600 }, (_, i) => `geo-id-${i}`);
    // Raw radius query: 600 matches, nearest first.
    prisma.$queryRaw.mockResolvedValueOnce(manyIds.map((id) => ({ id })));
    // Id-only pass applying the (empty) non-geo filters: every id still matches.
    prisma.property.findMany.mockResolvedValueOnce(manyIds.map((id) => ({ id })));
    // Hydrate pass: only the requested page's ids should ever reach this call.
    const pageRows = manyIds.slice(0, 20).map((id) => baseRow({ id }));
    prisma.property.findMany.mockResolvedValueOnce(pageRows);

    const result = await listProperties({
      lat: 8.9,
      lng: 76.6,
      radiusKm: 25,
      page: 1,
      limit: 20,
      sort: 'newest',
    });

    expect(result.meta.total).toBe(600);
    expect(result.meta.totalPages).toBe(30);
    expect(result.items).toHaveLength(20);

    // Only the page-sized slice was hydrated with the heavier include, not
    // all 600 candidates.
    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    const hydrateCall = prisma.property.findMany.mock.calls[1][0];
    expect(hydrateCall.where.id.in).toHaveLength(20);
    expect(hydrateCall.include).toBeDefined();
  });
});

describe('getPropertyBySlug — view count debounce', () => {
  it('increments the view count on the first view from a given viewer', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(
      baseRow({ id: 'debounce-fixture-a', status: 'AVAILABLE', viewCount: 5 }),
    );
    prisma.property.update.mockResolvedValueOnce({ viewCount: 6 });

    const result = await getPropertyBySlug('some-slug', undefined, 'viewer-a');

    expect(prisma.property.update).toHaveBeenCalledTimes(1);
    expect(result.viewCount).toBe(6);
  });

  it('does not increment again for the same viewer within the debounce window', async () => {
    prisma.property.findUnique.mockResolvedValue(
      baseRow({ id: 'debounce-fixture-b', status: 'AVAILABLE', viewCount: 5 }),
    );
    prisma.property.update.mockResolvedValueOnce({ viewCount: 6 });

    await getPropertyBySlug('some-slug', undefined, 'viewer-b');
    prisma.property.update.mockClear();

    const second = await getPropertyBySlug('some-slug', undefined, 'viewer-b');

    expect(prisma.property.update).not.toHaveBeenCalled();
    expect(second.viewCount).toBe(5);
  });

  it('increments independently for a different viewer on the same property', async () => {
    prisma.property.findUnique.mockResolvedValue(
      baseRow({ id: 'debounce-fixture-c', status: 'AVAILABLE', viewCount: 5 }),
    );
    prisma.property.update
      .mockResolvedValueOnce({ viewCount: 6 })
      .mockResolvedValueOnce({ viewCount: 6 });

    await getPropertyBySlug('some-slug', undefined, 'viewer-c1');
    await getPropertyBySlug('some-slug', undefined, 'viewer-c2');

    expect(prisma.property.update).toHaveBeenCalledTimes(2);
  });

  it('never counts a view when no viewer key is available at all', async () => {
    prisma.property.findUnique.mockResolvedValueOnce(
      baseRow({ id: 'debounce-fixture-d', status: 'AVAILABLE', viewCount: 5 }),
    );

    const result = await getPropertyBySlug('some-slug', undefined, undefined);

    expect(prisma.property.update).not.toHaveBeenCalled();
    expect(result.viewCount).toBe(5);
  });
});
