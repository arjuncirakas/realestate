import { describe, expect, it } from 'vitest';
import { formatSharePercentage, sumSharePercentages } from './format-share.js';

/**
 * `sharePercentage` is a `numeric(5,2)` column, but Prisma's
 * `Decimal#toString()` does not zero-pad to that scale (`docs/API.md` §3) —
 * `100.00` in the database arrives on the wire as `"100"`, not `"100.00"`.
 * These fixtures use the unpadded shape the API actually sends, plus a couple
 * of padded values, so both shapes stay covered.
 */
describe('formatSharePercentage', () => {
  it('renders an unpadded whole-number share as-is, not with a digit eaten', () => {
    expect(formatSharePercentage('100')).toBe('100%');
    expect(formatSharePercentage('40')).toBe('40%');
    expect(formatSharePercentage('60')).toBe('60%');
    expect(formatSharePercentage('10')).toBe('10%');
    expect(formatSharePercentage('20')).toBe('20%');
  });

  it('also trims a zero-padded whole-number share', () => {
    expect(formatSharePercentage('100.00')).toBe('100%');
    expect(formatSharePercentage('40.00')).toBe('40%');
  });

  it('keeps a genuine fraction, padded or not', () => {
    expect(formatSharePercentage('33.33')).toBe('33.33%');
    expect(formatSharePercentage('0.5')).toBe('0.5%');
  });

  it('renders the empty-value dash for a missing share', () => {
    expect(formatSharePercentage(null)).toBe('—');
    expect(formatSharePercentage(undefined)).toBe('—');
  });
});

describe('sumSharePercentages', () => {
  it('totals unpadded shares for display', () => {
    expect(sumSharePercentages([{ sharePercentage: '40' }, { sharePercentage: '60' }])).toBe(
      '100%',
    );
  });

  it('formats a fractional total the same way as a single share', () => {
    expect(
      sumSharePercentages([
        { sharePercentage: '33.33' },
        { sharePercentage: '33.33' },
        { sharePercentage: '33.34' },
      ]),
    ).toBe('100%');
  });
});
