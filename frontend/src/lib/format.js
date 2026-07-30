import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/**
 * Display formatters. Every one of these takes the wire format the API actually
 * sends — money and area as **strings**, dates as ISO — and returns something a
 * person reads. None of them parse money into a number for anything but display.
 *
 * Shown when a value is absent. An em dash reads as "no value recorded", which
 * in a land registry is different from zero.
 */
export const EMPTY_VALUE = '—';

const INR_GROUPING = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const INR_GROUPING_WITH_PAISE = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PLAIN_GROUPING = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/**
 * Parses a decimal string from the API into a number for display purposes only.
 * @param {string | number | null | undefined} value
 * @returns {number | null} null when the value is absent or unparseable
 */
const toDisplayNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Trims a scaled amount to at most two decimals with no trailing zeros, so
 * 58.00 reads as "58" and 1.30 as "1.3".
 * @param {number} amount
 * @returns {string}
 */
const trimScaled = (amount) => {
  const rounded = Math.round(amount * 100) / 100;
  return String(rounded);
};

/**
 * Formats an amount in rupees using Indian scale words.
 *
 * Kerala land is quoted in lakh and crore, so "₹58 lakh" is what a buyer expects
 * to read; "₹5,800,000" is not. Pass `compact: false` for a contract or a receipt,
 * where the exact grouped figure is what matters.
 *
 * @param {string | number | null | undefined} value money as a string from the API
 * @param {{ compact?: boolean, withPaise?: boolean }} [options]
 * @returns {string} e.g. `₹58 lakh`, `₹1.32 crore`, `₹45,000`, or `—`
 */
export const formatInr = (value, options = {}) => {
  const { compact = true, withPaise = false } = options;
  const amount = toDisplayNumber(value);
  if (amount === null) return EMPTY_VALUE;

  if (!compact) {
    const hasPaise = withPaise || Math.round(amount * 100) % 100 !== 0;
    return `₹${(hasPaise ? INR_GROUPING_WITH_PAISE : INR_GROUPING).format(amount)}`;
  }

  const absolute = Math.abs(amount);
  if (absolute >= 10_000_000) return `₹${trimScaled(amount / 10_000_000)} crore`;
  if (absolute >= 100_000) return `₹${trimScaled(amount / 100_000)} lakh`;
  return `₹${INR_GROUPING.format(amount)}`;
};

/**
 * The exact grouped rupee figure, with paise only when there are any.
 * @param {string | number | null | undefined} value
 * @returns {string} e.g. `₹58,00,000`
 */
export const formatInrExact = (value) => formatInr(value, { compact: false });

/** Unit labels, and whether the label takes a plural form. */
const AREA_UNITS = Object.freeze({
  SQFT: { singular: 'sq ft', plural: 'sq ft' },
  SQM: { singular: 'sq m', plural: 'sq m' },
  // "10 cent" is how a plot is described locally — never "10 cents".
  CENT: { singular: 'cent', plural: 'cent' },
  ACRE: { singular: 'acre', plural: 'acres' },
  HECTARE: { singular: 'hectare', plural: 'hectares' },
});

/**
 * Formats an area with its unit.
 * @param {string | number | null | undefined} value area as a string from the API
 * @param {string | null | undefined} unit an `AreaUnit` enum value
 * @returns {string} e.g. `10 cent`, `1,150 sq ft`, `2 acres`, or `—`
 */
export const formatArea = (value, unit) => {
  const amount = toDisplayNumber(value);
  if (amount === null) return EMPTY_VALUE;

  const labels = AREA_UNITS[unit];
  const formatted = PLAIN_GROUPING.format(amount);
  if (!labels) return formatted;

  return `${formatted} ${amount === 1 ? labels.singular : labels.plural}`;
};

/**
 * The bare unit label, for a table column header or a form suffix.
 * @param {string | null | undefined} unit an `AreaUnit` enum value
 * @returns {string}
 */
export const areaUnitLabel = (unit) => AREA_UNITS[unit]?.singular ?? '';

/**
 * Parses either an ISO timestamp or a `YYYY-MM-DD` date column.
 *
 * `parseISO` reads a date-only string as local midnight, which is what keeps a
 * `preferredDate` of `2026-08-08` from displaying as the 7th.
 *
 * @param {string | Date | null | undefined} value
 * @returns {Date | null}
 */
const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
};

/**
 * A date, without a time.
 * @param {string | Date | null | undefined} value ISO timestamp or `YYYY-MM-DD`
 * @returns {string} e.g. `12 Jan 2026`, or `—`
 */
export const formatDate = (value) => {
  const date = toDate(value);
  return date ? format(date, 'd MMM yyyy') : EMPTY_VALUE;
};

/**
 * A date with a time, for audit-style records.
 * @param {string | Date | null | undefined} value
 * @returns {string} e.g. `12 Jan 2026, 2:30 pm`, or `—`
 */
export const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy, h:mm aaa") : EMPTY_VALUE;
};

/**
 * How long ago something happened, for queues and activity lists.
 * @param {string | Date | null | undefined} value
 * @returns {string} e.g. `3 days ago`, or `—`
 */
export const formatTimeAgo = (value) => {
  const date = toDate(value);
  return date ? `${formatDistanceToNowStrict(date)} ago` : EMPTY_VALUE;
};

/**
 * A `YYYY-MM-DD` string for a date input's `value`, from any accepted form.
 * @param {string | Date | null | undefined} value
 * @returns {string} empty string when absent, so it can go straight into an input
 */
export const toDateInputValue = (value) => {
  const date = toDate(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
};

/**
 * Joins the parts of an address that are present, skipping the blanks.
 * @param {{ addressLine?: string|null, locality?: string|null, city?: string|null, district?: string|null, state?: string|null, pincode?: string|null }} property
 * @returns {string}
 */
export const formatAddress = (property) => {
  if (!property) return EMPTY_VALUE;
  const parts = [
    property.addressLine,
    property.locality,
    property.city,
    property.district && property.district !== property.city ? property.district : null,
    property.state,
    property.pincode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : EMPTY_VALUE;
};
