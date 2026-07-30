import { describe, expect, it } from 'vitest';
import {
  AreaUnit,
  EnquiryStatus,
  InterestStatus,
  LogType,
  PropertyStatus,
  PropertyType,
  UserRole,
  VisitSlot,
  VisitStatus,
} from '@/contracts/index.js';
import {
  AREA_UNIT_LABEL,
  ENQUIRY_STATUS_LABEL,
  ENQUIRY_STATUS_TONE,
  INTEREST_STATUS_LABEL,
  INTEREST_STATUS_TONE,
  LOG_TYPE_LABEL,
  PROPERTY_STATUS_LABEL,
  PROPERTY_STATUS_TONE,
  PROPERTY_TYPE_LABEL,
  USER_ROLE_LABEL,
  VISIT_SLOT_LABEL,
  VISIT_STATUS_LABEL,
  VISIT_STATUS_TONE,
  toSelectOptions,
} from './labels.js';

/**
 * The point of these: adding a value to a Prisma enum without labelling it here
 * would otherwise render the raw `UNDER_OFFER` at a buyer. This fails instead.
 */
const LABEL_MAPS = [
  ['UserRole', UserRole, USER_ROLE_LABEL],
  ['PropertyType', PropertyType, PROPERTY_TYPE_LABEL],
  ['PropertyStatus', PropertyStatus, PROPERTY_STATUS_LABEL],
  ['AreaUnit', AreaUnit, AREA_UNIT_LABEL],
  ['EnquiryStatus', EnquiryStatus, ENQUIRY_STATUS_LABEL],
  ['VisitStatus', VisitStatus, VISIT_STATUS_LABEL],
  ['VisitSlot', VisitSlot, VISIT_SLOT_LABEL],
  ['InterestStatus', InterestStatus, INTEREST_STATUS_LABEL],
  ['LogType', LogType, LOG_TYPE_LABEL],
];

describe('every enum value has a label', () => {
  it.each(LABEL_MAPS)('%s', (_name, enumObject, labelMap) => {
    for (const value of Object.values(enumObject)) {
      expect(labelMap[value], `missing label for ${value}`).toBeTruthy();
    }
    // And no label for a value that does not exist.
    expect(Object.keys(labelMap).sort()).toEqual(Object.values(enumObject).sort());
  });
});

describe('labels are sentence case', () => {
  it.each(LABEL_MAPS)('%s', (_name, _enumObject, labelMap) => {
    for (const label of Object.values(labelMap)) {
      // First character upper, and no SHOUTING or Title Case Everywhere.
      expect(label[0]).toBe(label[0].toUpperCase());
      expect(label).not.toBe(label.toUpperCase());
      expect(label).not.toContain('_');
    }
  });
});

describe('every status has a badge tone', () => {
  it.each([
    ['PropertyStatus', PropertyStatus, PROPERTY_STATUS_TONE],
    ['EnquiryStatus', EnquiryStatus, ENQUIRY_STATUS_TONE],
    ['VisitStatus', VisitStatus, VISIT_STATUS_TONE],
    ['InterestStatus', InterestStatus, INTEREST_STATUS_TONE],
  ])('%s', (_name, enumObject, toneMap) => {
    const allowed = ['neutral', 'muted', 'moss', 'clay'];
    for (const value of Object.values(enumObject)) {
      expect(allowed, `bad tone for ${value}`).toContain(toneMap[value]);
    }
  });
});

describe('interest register wording stays inside Section 1.3', () => {
  it('uses none of the prohibited vocabulary', () => {
    const text = Object.values(INTEREST_STATUS_LABEL).join(' ').toLowerCase();
    for (const banned of ['invest', 'share', 'dividend', 'unit', 'return', 'yield']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('toSelectOptions', () => {
  it('turns a label map into value/label pairs in order', () => {
    expect(toSelectOptions(VISIT_SLOT_LABEL)).toEqual([
      { value: 'MORNING', label: 'Morning' },
      { value: 'AFTERNOON', label: 'Afternoon' },
      { value: 'EVENING', label: 'Evening' },
    ]);
  });
});
