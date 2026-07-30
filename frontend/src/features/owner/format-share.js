import { EMPTY_VALUE } from '@/lib/format.js';

/**
 * `sharePercentage` arrives from the API as a decimal string from a
 * `numeric(5,2)` column (Section 4.2) — but Prisma's `Decimal#toString()` does
 * not zero-pad to the column scale (`docs/API.md` §3): `100.00` in the
 * database comes across the wire as `"100"`, `40.00` as `"40"`. Only `"33.33"`
 * arrives with a fraction at all. So the trim below only touches a fractional
 * part, and only when one is present — running it over a bare integer would
 * eat its trailing zeros as if they were padding, turning `"100"` into `"1"`.
 * It is never run through `parseFloat` either way, for the same reason money
 * stays a string end to end: no binary floating-point rounding in between.
 */

/**
 * Trims a percentage string to how a person would say it: `"40.00"` and
 * `"40"` both read as `40%`, `"33.33"` keeps its fraction.
 * @param {string | null | undefined} value
 * @returns {string} e.g. `40%`, `33.33%`, or `—`
 */
export const formatSharePercentage = (value) => {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  const stringValue = String(value);
  const trimmed = stringValue.includes('.')
    ? stringValue.replace(/0+$/, '').replace(/\.$/, '')
    : stringValue;
  return `${trimmed}%`;
};

/**
 * Totals a set of ownership shares for display only — e.g. an "allocated so
 * far" line under a co-owner table. Not used for anything that enforces the
 * 100% cap; that check lives server-side (Section 4.2).
 * @param {Array<{ sharePercentage: string }>} ownerships
 * @returns {string} e.g. `100%`, formatted the same way as a single share
 */
export const sumSharePercentages = (ownerships) => {
  const total = ownerships.reduce((sum, { sharePercentage }) => sum + Number(sharePercentage), 0);
  return formatSharePercentage(total.toFixed(2));
};
