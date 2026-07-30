import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  areaUnitLabel,
  formatAddress,
  formatArea,
  formatDate,
  formatDateTime,
  formatInr,
  formatInrExact,
  toDateInputValue,
} from './format.js';

describe('formatInr', () => {
  it('uses crore above one crore', () => {
    expect(formatInr('13200000')).toBe('₹1.32 crore');
    expect(formatInr('10000000')).toBe('₹1 crore');
    expect(formatInr('145000000')).toBe('₹14.5 crore');
  });

  it('uses lakh between one lakh and one crore', () => {
    expect(formatInr('5800000')).toBe('₹58 lakh');
    expect(formatInr('100000')).toBe('₹1 lakh');
    expect(formatInr('2300000')).toBe('₹23 lakh');
    expect(formatInr('9999999')).toBe('₹100 lakh');
  });

  it('groups rupees below one lakh in the Indian style', () => {
    expect(formatInr('45000')).toBe('₹45,000');
    expect(formatInr('99999')).toBe('₹99,999');
  });

  it('drops trailing zeros from the scaled figure', () => {
    // 58.00 lakh should read as "58 lakh", not "58.00 lakh".
    expect(formatInr('5800000')).not.toContain('.00');
    expect(formatInr('5850000')).toBe('₹58.5 lakh');
  });

  it('accepts the string form the API actually sends', () => {
    // Money crosses the wire as a string (Section 9.2); a number must still work
    // for a locally computed total, but the string path is the real one.
    expect(formatInr('5800000.00')).toBe('₹58 lakh');
    expect(formatInr(5800000)).toBe('₹58 lakh');
  });

  it('renders an em dash for an absent value', () => {
    expect(formatInr(null)).toBe(EMPTY_VALUE);
    expect(formatInr(undefined)).toBe(EMPTY_VALUE);
    expect(formatInr('')).toBe(EMPTY_VALUE);
    expect(formatInr('not a number')).toBe(EMPTY_VALUE);
  });
});

describe('formatInrExact', () => {
  it('groups in the Indian system, not thousands', () => {
    // 58,00,000 — two digits per group above the first three.
    expect(formatInrExact('5800000')).toBe('₹58,00,000');
    expect(formatInrExact('13200000')).toBe('₹1,32,00,000');
  });

  it('shows paise only when there are any', () => {
    expect(formatInrExact('5800000')).toBe('₹58,00,000');
    expect(formatInrExact('5800000.25')).toBe('₹58,00,000.25');
  });
});

describe('formatArea', () => {
  it('never pluralises cent, which is how a plot is described locally', () => {
    expect(formatArea('10', 'CENT')).toBe('10 cent');
    expect(formatArea('1', 'CENT')).toBe('1 cent');
  });

  it('pluralises acre and hectare', () => {
    expect(formatArea('1', 'ACRE')).toBe('1 acre');
    expect(formatArea('2', 'ACRE')).toBe('2 acres');
    expect(formatArea('1', 'HECTARE')).toBe('1 hectare');
    expect(formatArea('3.5', 'HECTARE')).toBe('3.5 hectares');
  });

  it('groups large square footage', () => {
    expect(formatArea('1150', 'SQFT')).toBe('1,150 sq ft');
    expect(formatArea('1150', 'SQM')).toBe('1,150 sq m');
  });

  it('handles an absent value or unknown unit', () => {
    expect(formatArea(null, 'CENT')).toBe(EMPTY_VALUE);
    expect(formatArea('10', null)).toBe('10');
  });

  it('exposes the bare unit label', () => {
    expect(areaUnitLabel('CENT')).toBe('cent');
    expect(areaUnitLabel('SQFT')).toBe('sq ft');
    expect(areaUnitLabel(undefined)).toBe('');
  });
});

describe('dates', () => {
  it('formats a date-only column without shifting the day', () => {
    // The regression this guards: reading YYYY-MM-DD as UTC midnight and then
    // rendering in local time can show the previous day.
    expect(formatDate('2026-08-08')).toBe('8 Aug 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('formats an ISO timestamp', () => {
    expect(formatDate('2026-07-30T09:00:00.000Z')).toMatch(/^\d{1,2} Jul 2026$/);
    expect(formatDateTime('2026-07-30T09:00:00.000Z')).toMatch(/2026, \d{1,2}:\d{2} (am|pm)$/);
  });

  it('round-trips through a date input value', () => {
    expect(toDateInputValue('2026-08-08')).toBe('2026-08-08');
    expect(toDateInputValue(null)).toBe('');
  });

  it('renders an em dash for an absent or invalid date', () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE);
    expect(formatDate('not a date')).toBe(EMPTY_VALUE);
  });
});

describe('formatAddress', () => {
  it('joins the parts that are present', () => {
    expect(
      formatAddress({
        addressLine: 'Survey 142/3B, Kazhakkoottam',
        locality: 'Kazhakkoottam',
        city: 'Thiruvananthapuram',
        district: 'Thiruvananthapuram',
        state: 'Kerala',
        pincode: '695582',
      }),
    ).toBe('Survey 142/3B, Kazhakkoottam, Kazhakkoottam, Thiruvananthapuram, Kerala, 695582');
  });

  it('skips blanks and does not repeat the district when it equals the city', () => {
    expect(formatAddress({ city: 'Kollam', district: 'Kollam', state: 'Kerala' })).toBe(
      'Kollam, Kerala',
    );
  });

  it('handles nothing at all', () => {
    expect(formatAddress(null)).toBe(EMPTY_VALUE);
    expect(formatAddress({})).toBe(EMPTY_VALUE);
  });
});
