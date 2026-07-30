import { z } from 'zod';

/**
 * Scalar building blocks shared by every other contract file: ids, dates,
 * decimal-as-string values, coordinates, route params and query-string helpers.
 *
 * Serialisation rules these schemas encode, which services must follow:
 * - `numeric` columns cross the wire as **strings** (Section 9.2). Convert
 *   Prisma `Decimal` with `.toString()`.
 * - `timestamptz` columns cross the wire as ISO 8601 strings.
 * - `date` columns cross the wire as `YYYY-MM-DD`, not as a full timestamp.
 */

export const UuidSchema = z.string().uuid('Must be a valid id');

export const EmailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254)
  .email('Enter a valid email address')
  // citext columns compare case-insensitively; normalising on the way in keeps
  // stored values tidy too.
  .transform((value) => value.toLowerCase());

export const PersonNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter a name of at least 2 characters')
  .max(120, 'Name must be 120 characters or fewer');

/** Reserved for a future OTP flow (Section 1.2) — no SMS provider is wired up. */
export const PhoneSchema = z
  .string()
  .trim()
  .min(6, 'Enter a valid phone number')
  .max(20, 'Phone number must be 20 characters or fewer')
  .regex(/^[+]?[0-9\s-]+$/, 'Phone number may contain digits, spaces, - and + only');

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO 8601 timestamp' });

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD form')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Must be a real date');

/** `numeric(14,2)` money, as a string. Never a JS number (Section 9.2). */
export const MoneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Must be an amount with up to two decimal places');

/** Money that must be greater than zero — prices and indicative amounts. */
export const PositiveMoneySchema = MoneySchema.refine(
  (value) => Number(value) > 0,
  'Must be greater than zero',
);

/** `numeric(12,2)` area value, as a string. */
export const AreaValueSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Must be an area with up to two decimal places')
  .refine((value) => Number(value) > 0, 'Must be greater than zero');

/** `numeric(5,2)` ownership share, as a string in (0, 100]. */
export const SharePercentageSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Must be a percentage with up to two decimal places')
  .refine((value) => Number(value) > 0 && Number(value) <= 100, 'Must be between 0 and 100');

export const LatitudeSchema = z.coerce
  .number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

export const LongitudeSchema = z.coerce
  .number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

/**
 * Treats an omitted query parameter and a cleared one (`?minPrice=`) the same
 * way, so a filter the user has emptied does not fail validation.
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('zod').ZodTypeAny}
 */
export const optionalParam = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

/**
 * Query-string boolean. `z.coerce.boolean()` is unusable here because it maps
 * the string `'false'` to `true`.
 */
export const BooleanQuerySchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean());

/**
 * Rejects an empty PATCH body, which would otherwise be a silent no-op.
 * @param {import('zod').ZodObject<any>} schema
 * @returns {import('zod').ZodTypeAny}
 */
export const atLeastOneField = (schema) =>
  schema.refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

/** `page`/`limit` for every paginated endpoint. `limit` is capped at 50 (Section 5.2). */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const IdParamSchema = z.object({ id: UuidSchema });

export const SlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9-]+$/, 'Not a valid slug'),
});

/** For routes that name the parameter `:propertyId` (saved properties). */
export const PropertyIdParamSchema = z.object({ propertyId: UuidSchema });
