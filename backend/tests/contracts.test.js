import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/contracts/index.js';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Guards the contract layer itself. A drift between the Prisma enums and the
 * contract enums, or a money field that quietly starts accepting a JS number,
 * would break every module downstream — and nothing else in the project would
 * catch it.
 */

/**
 * Reads the enum blocks out of schema.prisma so the two definitions are compared
 * against each other rather than both against a hand-written list.
 * @returns {Record<string, string[]>}
 */
const readPrismaEnums = () => {
  const schema = readFileSync(path.join(BACKEND_ROOT, 'prisma', 'schema.prisma'), 'utf8');
  const enums = {};
  for (const match of schema.matchAll(/enum (\w+) \{([^}]*)\}/g)) {
    enums[match[1]] = match[2]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));
  }
  return enums;
};

describe('enums match prisma/schema.prisma', () => {
  const prismaEnums = readPrismaEnums();

  it('finds all ten enums in the schema', () => {
    expect(Object.keys(prismaEnums)).toHaveLength(10);
  });

  for (const [name, values] of Object.entries(prismaEnums)) {
    it(`${name} has the same values, in the same order`, () => {
      expect(Object.values(contracts[name])).toEqual(values);
      expect(contracts[`${name}Schema`].options).toEqual(values);
    });

    it(`${name} is frozen`, () => {
      expect(Object.isFrozen(contracts[name])).toBe(true);
    });
  }
});

describe('money is a string, never a number', () => {
  it('rejects a JS number for a price', () => {
    expect(contracts.MoneySchema.safeParse(4500000).success).toBe(false);
    expect(contracts.MoneySchema.safeParse('4500000').success).toBe(true);
    expect(contracts.MoneySchema.safeParse('4500000.50').success).toBe(true);
  });

  it('rejects more than two decimal places', () => {
    expect(contracts.MoneySchema.safeParse('10.123').success).toBe(false);
  });

  it('rejects a numeric price on property create', () => {
    const base = {
      title: 'Ten cent plot near Kazhakkoottam',
      propertyType: 'PLOT',
      areaValue: '10',
      areaUnit: 'CENT',
      city: 'Thiruvananthapuram',
      state: 'Kerala',
    };
    expect(contracts.PropertyCreateSchema.safeParse({ ...base, price: 4500000 }).success).toBe(
      false,
    );
    expect(contracts.PropertyCreateSchema.safeParse({ ...base, price: '4500000' }).success).toBe(
      true,
    );
  });
});

describe('dates', () => {
  it('accepts a date-only string and rejects a timestamp for a date column', () => {
    expect(contracts.IsoDateSchema.safeParse('2026-08-08').success).toBe(true);
    expect(contracts.IsoDateSchema.safeParse('2026-08-08T00:00:00Z').success).toBe(false);
  });

  it('accepts an ISO timestamp for a timestamptz column', () => {
    expect(contracts.IsoDateTimeSchema.safeParse('2026-07-30T09:00:00.000Z').success).toBe(true);
    expect(contracts.IsoDateTimeSchema.safeParse('2026-07-30').success).toBe(false);
  });
});

describe('pagination', () => {
  it('defaults to page 1, limit 20', () => {
    expect(contracts.PaginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('caps limit at 50', () => {
    expect(contracts.PaginationQuerySchema.safeParse({ limit: '50' }).success).toBe(true);
    expect(contracts.PaginationQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
});

describe('query filters', () => {
  it('treats a cleared filter as absent', () => {
    const parsed = contracts.PropertyListQuerySchema.safeParse({ q: '', minPrice: '', city: '' });
    expect(parsed.success).toBe(true);
    expect(parsed.data.minPrice).toBeUndefined();
  });

  it('requires lat, lng and radiusKm together', () => {
    expect(contracts.PropertyListQuerySchema.safeParse({ lat: '8.5' }).success).toBe(false);
    expect(
      contracts.PropertyListQuerySchema.safeParse({ lat: '8.5', lng: '76.9', radiusKm: '5' })
        .success,
    ).toBe(true);
  });

  it('rejects an inverted bounding box', () => {
    expect(
      contracts.PropertyMapQuerySchema.safeParse({
        minLng: '77.5',
        minLat: '8',
        maxLng: '76',
        maxLat: '9',
      }).success,
    ).toBe(false);
  });

  it('reads false correctly from a query-string boolean', () => {
    expect(contracts.BooleanQuerySchema.parse('false')).toBe(false);
    expect(contracts.BooleanQuerySchema.parse('true')).toBe(true);
  });
});

describe('passwords', () => {
  it('requires 8 characters with a letter and a number', () => {
    expect(contracts.PasswordSchema.safeParse('Password123').success).toBe(true);
    expect(contracts.PasswordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(contracts.PasswordSchema.safeParse('12345678').success).toBe(false);
    expect(contracts.PasswordSchema.safeParse('Pass1').success).toBe(false);
  });

  it('rejects a password beyond bcrypt 72-byte truncation', () => {
    expect(contracts.PasswordSchema.safeParse('a1'.repeat(40)).success).toBe(false);
  });

  it('does not apply the strength rules on login', () => {
    // Tightening the password policy must never lock out an existing account.
    expect(contracts.LoginSchema.safeParse({ email: 'a@b.co', password: 'old' }).success).toBe(
      true,
    );
  });
});

describe('an empty PATCH body is rejected', () => {
  it.each([
    ['MeUpdateSchema'],
    ['AdminUserUpdateSchema'],
    ['MediaUpdateSchema'],
    ['EnquiryUpdateSchema'],
    ['SiteVisitUpdateSchema'],
    ['InterestUpdateSchema'],
    ['OwnershipUpdateSchema'],
    ['ManagementLogUpdateSchema'],
    ['PropertyUpdateSchema'],
  ])('%s', (name) => {
    expect(contracts[name].safeParse({}).success).toBe(false);
  });
});

describe('responses do not expose internal columns', () => {
  it('omits storageKey from media', () => {
    const row = {
      id: '4f6c9d1e-1a2b-4c3d-8e5f-6a7b8c9d0e1f',
      propertyId: '5f6c9d1e-1a2b-4c3d-8e5f-6a7b8c9d0e1f',
      type: 'IMAGE',
      url: '/uploads/x.jpg',
      caption: null,
      sortOrder: 0,
      isCover: true,
      createdAt: '2026-07-30T09:00:00.000Z',
      storageKey: 'property-media/secret.jpg',
    };
    const parsed = contracts.PropertyMediaResponseSchema.parse(row);
    expect(parsed).not.toHaveProperty('storageKey');
  });
});

describe('error vocabulary', () => {
  it('maps all seven codes to the statuses in Section 5.1', () => {
    expect(contracts.ERROR_STATUS_BY_CODE).toEqual({
      VALIDATION_ERROR: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
    });
  });

  it('rejects an envelope with an unknown code', () => {
    expect(
      contracts.ErrorEnvelopeSchema.safeParse({ error: { code: 'BOOM', message: 'x' } }).success,
    ).toBe(false);
  });
});

describe('upload limits', () => {
  it('matches Section 5.2', () => {
    expect(contracts.UPLOAD_LIMITS.maxFiles).toBe(10);
    expect(contracts.UPLOAD_LIMITS.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(Object.keys(contracts.ACCEPTED_MIME_TYPES)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'application/pdf',
    ]);
  });

  it('rejects a type that is not on the allowlist', () => {
    expect(contracts.AcceptedMimeTypeSchema.safeParse('image/gif').success).toBe(false);
    expect(contracts.AcceptedMimeTypeSchema.safeParse('text/html').success).toBe(false);
  });
});

describe('Section 1.3 copy compliance', () => {
  const files = [
    'enums.js',
    'common.contract.js',
    'envelope.contract.js',
    'auth.contract.js',
    'property.contract.js',
    'media.contract.js',
    'engagement.contract.js',
    'ownership.contract.js',
    'index.js',
  ];

  it.each(files)('%s contains no prohibited vocabulary', (file) => {
    const text = readFileSync(path.join(BACKEND_ROOT, 'src', 'contracts', file), 'utf8');
    expect(text).not.toMatch(
      /\b(invest|investment|investor|investors|shares|dividend|roi|yield|appreciation|portfolio returns?)\b/i,
    );
  });

  it('keeps the interest schema free of any financial-performance field', () => {
    const fields = Object.keys(contracts.InterestResponseSchema.shape);
    for (const field of fields) {
      expect(field).not.toMatch(/return|yield|roi|profit|appreciation/i);
    }
    // The one amount on the record is explicitly indicative.
    expect(fields).toContain('indicativeAmount');
  });
});
