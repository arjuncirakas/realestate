import { z } from 'zod';

/**
 * Every enum from Section 4.1, as a frozen `{ VALUE: 'VALUE' }` object plus a
 * matching zod schema. The values here must stay identical to the Prisma enums
 * in `prisma/schema.prisma`.
 *
 * This file has no imports from the rest of the codebase and no side effects,
 * so both the backend and the copied frontend tree can load it safely.
 */

/**
 * Builds a frozen `{ VALUE: 'VALUE' }` lookup from a list of literals, so the
 * enum object and its zod schema can never drift apart.
 * @param {string[]} values
 * @returns {Readonly<Record<string, string>>}
 */
const freezeEnum = (values) => Object.freeze(Object.fromEntries(values.map((v) => [v, v])));

const USER_ROLES = ['SUBSCRIBER', 'AGENT', 'ADMIN'];
const PROPERTY_TYPES = ['PLOT', 'HOUSE', 'APARTMENT', 'COMMERCIAL', 'FARMLAND'];
const PROPERTY_STATUSES = ['DRAFT', 'AVAILABLE', 'UNDER_OFFER', 'SOLD', 'WITHDRAWN'];
const AREA_UNITS = ['SQFT', 'SQM', 'CENT', 'ACRE', 'HECTARE'];
const MEDIA_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT', 'TOUR_360'];
const ENQUIRY_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'];
const VISIT_STATUSES = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const INTEREST_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WITHDRAWN', 'CLOSED'];
const LOG_TYPES = ['INSPECTION', 'MAINTENANCE', 'TAX', 'LEGAL', 'BOUNDARY', 'OTHER'];
const VISIT_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'];

export const UserRole = freezeEnum(USER_ROLES);
export const UserRoleSchema = z.enum(USER_ROLES);

export const PropertyType = freezeEnum(PROPERTY_TYPES);
export const PropertyTypeSchema = z.enum(PROPERTY_TYPES);

export const PropertyStatus = freezeEnum(PROPERTY_STATUSES);
export const PropertyStatusSchema = z.enum(PROPERTY_STATUSES);

export const AreaUnit = freezeEnum(AREA_UNITS);
export const AreaUnitSchema = z.enum(AREA_UNITS);

export const MediaType = freezeEnum(MEDIA_TYPES);
export const MediaTypeSchema = z.enum(MEDIA_TYPES);

export const EnquiryStatus = freezeEnum(ENQUIRY_STATUSES);
export const EnquiryStatusSchema = z.enum(ENQUIRY_STATUSES);

export const VisitStatus = freezeEnum(VISIT_STATUSES);
export const VisitStatusSchema = z.enum(VISIT_STATUSES);

export const InterestStatus = freezeEnum(INTEREST_STATUSES);
export const InterestStatusSchema = z.enum(INTEREST_STATUSES);

export const LogType = freezeEnum(LOG_TYPES);
export const LogTypeSchema = z.enum(LOG_TYPES);

export const VisitSlot = freezeEnum(VISIT_SLOTS);
export const VisitSlotSchema = z.enum(VISIT_SLOTS);

/**
 * Statuses a visitor without an agent or admin role may see in the catalogue.
 * Anything else is agency-internal.
 */
export const PUBLIC_PROPERTY_STATUSES = Object.freeze(['AVAILABLE', 'UNDER_OFFER', 'SOLD']);
