/**
 * Converters that put a Prisma row into the shape the contracts expect.
 *
 * Two rules drive all of this: money and other `numeric` columns cross the wire
 * as strings (Section 9.2), and a `date` column crosses as `YYYY-MM-DD` rather
 * than a full timestamp. Prisma hands back `Decimal` and `Date` objects for
 * both, so every service converts at its boundary.
 */

/**
 * Prisma `Decimal` (or null) to a string the contracts accept.
 * @param {{ toString: () => string } | null | undefined} value
 * @returns {string | null}
 */
export const toDecimalString = (value) =>
  value === null || value === undefined ? null : value.toString();

/**
 * A `timestamptz` column to an ISO 8601 string.
 * @param {Date | null | undefined} value
 * @returns {string | null}
 */
export const toIsoDateTime = (value) =>
  value === null || value === undefined ? null : value.toISOString();

/**
 * A `date` column to `YYYY-MM-DD`. Prisma returns these as a `Date` at UTC
 * midnight, so taking the date part of the ISO string is exact — converting to
 * local time first would shift the day.
 * @param {Date | null | undefined} value
 * @returns {string | null}
 */
export const toIsoDate = (value) =>
  value === null || value === undefined ? null : value.toISOString().slice(0, 10);

/**
 * Parses a `YYYY-MM-DD` request value into the `Date` a `@db.Date` column wants.
 * @param {string | null | undefined} value
 * @returns {Date | null}
 */
export const fromIsoDate = (value) =>
  value === null || value === undefined ? null : new Date(`${value}T00:00:00.000Z`);
