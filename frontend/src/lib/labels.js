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

/**
 * Human labels for every enum, in sentence case (Section 7.2).
 *
 * These live here rather than in each feature so that six teammates cannot
 * arrive at six spellings of `UNDER_OFFER`. The maps are keyed off the contract
 * enums, and a test asserts every enum value has a label — so adding a value to
 * the schema without labelling it fails the build rather than rendering
 * `UNDER_OFFER` at a buyer.
 */

export const USER_ROLE_LABEL = Object.freeze({
  [UserRole.SUBSCRIBER]: 'Subscriber',
  [UserRole.AGENT]: 'Agent',
  [UserRole.ADMIN]: 'Admin',
});

export const PROPERTY_TYPE_LABEL = Object.freeze({
  [PropertyType.PLOT]: 'Plot',
  [PropertyType.HOUSE]: 'House',
  [PropertyType.APARTMENT]: 'Apartment',
  [PropertyType.COMMERCIAL]: 'Commercial',
  [PropertyType.FARMLAND]: 'Farmland',
});

export const PROPERTY_STATUS_LABEL = Object.freeze({
  [PropertyStatus.DRAFT]: 'Draft',
  [PropertyStatus.AVAILABLE]: 'Available',
  [PropertyStatus.UNDER_OFFER]: 'Under offer',
  [PropertyStatus.SOLD]: 'Sold',
  [PropertyStatus.WITHDRAWN]: 'Withdrawn',
});

export const AREA_UNIT_LABEL = Object.freeze({
  [AreaUnit.SQFT]: 'Sq ft',
  [AreaUnit.SQM]: 'Sq m',
  [AreaUnit.CENT]: 'Cent',
  [AreaUnit.ACRE]: 'Acre',
  [AreaUnit.HECTARE]: 'Hectare',
});

export const ENQUIRY_STATUS_LABEL = Object.freeze({
  [EnquiryStatus.NEW]: 'New',
  [EnquiryStatus.CONTACTED]: 'Contacted',
  [EnquiryStatus.QUALIFIED]: 'Qualified',
  [EnquiryStatus.CLOSED]: 'Closed',
});

export const VISIT_STATUS_LABEL = Object.freeze({
  [VisitStatus.REQUESTED]: 'Requested',
  [VisitStatus.CONFIRMED]: 'Confirmed',
  [VisitStatus.COMPLETED]: 'Completed',
  [VisitStatus.CANCELLED]: 'Cancelled',
  [VisitStatus.NO_SHOW]: 'No show',
});

export const VISIT_SLOT_LABEL = Object.freeze({
  [VisitSlot.MORNING]: 'Morning',
  [VisitSlot.AFTERNOON]: 'Afternoon',
  [VisitSlot.EVENING]: 'Evening',
});

/**
 * Interest registration statuses. Wording stays inside the approved vocabulary
 * of Section 1.3 — this is a register of enquiries, nothing more.
 */
export const INTEREST_STATUS_LABEL = Object.freeze({
  [InterestStatus.NEW]: 'New',
  [InterestStatus.CONTACTED]: 'Contacted',
  [InterestStatus.QUALIFIED]: 'Qualified',
  [InterestStatus.WITHDRAWN]: 'Withdrawn',
  [InterestStatus.CLOSED]: 'Closed',
});

export const LOG_TYPE_LABEL = Object.freeze({
  [LogType.INSPECTION]: 'Inspection',
  [LogType.MAINTENANCE]: 'Maintenance',
  [LogType.TAX]: 'Tax',
  [LogType.LEGAL]: 'Legal',
  [LogType.BOUNDARY]: 'Boundary',
  [LogType.OTHER]: 'Other',
});

/**
 * Badge tone per property status, so a plot's state reads the same everywhere.
 * Only `AVAILABLE` gets the moss accent; nothing else earns colour.
 */
export const PROPERTY_STATUS_TONE = Object.freeze({
  [PropertyStatus.DRAFT]: 'muted',
  [PropertyStatus.AVAILABLE]: 'moss',
  [PropertyStatus.UNDER_OFFER]: 'clay',
  [PropertyStatus.SOLD]: 'neutral',
  [PropertyStatus.WITHDRAWN]: 'muted',
});

/** Badge tone per enquiry status. */
export const ENQUIRY_STATUS_TONE = Object.freeze({
  [EnquiryStatus.NEW]: 'moss',
  [EnquiryStatus.CONTACTED]: 'clay',
  [EnquiryStatus.QUALIFIED]: 'moss',
  [EnquiryStatus.CLOSED]: 'muted',
});

/** Badge tone per visit status. */
export const VISIT_STATUS_TONE = Object.freeze({
  [VisitStatus.REQUESTED]: 'clay',
  [VisitStatus.CONFIRMED]: 'moss',
  [VisitStatus.COMPLETED]: 'neutral',
  [VisitStatus.CANCELLED]: 'muted',
  [VisitStatus.NO_SHOW]: 'muted',
});

/** Badge tone per interest registration status. */
export const INTEREST_STATUS_TONE = Object.freeze({
  [InterestStatus.NEW]: 'moss',
  [InterestStatus.CONTACTED]: 'clay',
  [InterestStatus.QUALIFIED]: 'moss',
  [InterestStatus.WITHDRAWN]: 'muted',
  [InterestStatus.CLOSED]: 'muted',
});

/**
 * Turns a label map into the `{ value, label }` list a Select expects.
 * @param {Readonly<Record<string, string>>} labelMap one of the maps above
 * @returns {Array<{ value: string, label: string }>}
 */
export const toSelectOptions = (labelMap) =>
  Object.entries(labelMap).map(([value, label]) => ({ value, label }));
