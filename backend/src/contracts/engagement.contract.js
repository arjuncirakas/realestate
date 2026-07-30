import { z } from 'zod';
import {
  EnquiryStatusSchema,
  InterestStatusSchema,
  VisitSlotSchema,
  VisitStatusSchema,
} from './enums.js';
import {
  atLeastOneField,
  EmailSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  optionalParam,
  PaginationQuerySchema,
  PersonNameSchema,
  PhoneSchema,
  PositiveMoneySchema,
  UuidSchema,
} from './common.contract.js';
import { PropertySummarySchema } from './property.contract.js';
import { UserSummarySchema } from './auth.contract.js';

/**
 * Everything a person does with a listing: enquiries, site visit requests,
 * saved plots and group-purchase interest registrations (Section 5.2).
 *
 * Copy note for the interest schemas (Section 1.3): this is an
 * expression-of-interest register and nothing more. Field names and messages
 * use "indicative amount" and "register interest" only. No schema here carries
 * any of the financial-performance figures Section 1.3 prohibits, and none
 * implies that submitting a registration creates a commitment.
 */

// --- Enquiries --------------------------------------------------------------

/**
 * `POST /properties/:id/enquiries` — public and rate-limited. Guests supply
 * their own contact details; for a signed-in user the service also records
 * `userId`, but the visible fields are still whatever the form submitted.
 */
export const EnquiryCreateSchema = z.object({
  name: PersonNameSchema,
  email: EmailSchema,
  phone: PhoneSchema.optional(),
  message: z.string().trim().min(10, 'Tell us a little more — at least 10 characters').max(2000),
});

export const EnquiryResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  userId: UuidSchema.nullable(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string(),
  status: EnquiryStatusSchema,
  assignedAgentId: UuidSchema.nullable(),
  assignedAgent: UserSummarySchema.nullable(),
  agentNotes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

/** Row shape for `GET /enquiries` — the agent queue. */
export const EnquiryWithPropertySchema = EnquiryResponseSchema.extend({
  property: PropertySummarySchema,
});

export const EnquiryListResponseSchema = z.array(EnquiryWithPropertySchema);

/**
 * Row shape for `GET /me/enquiries` — the enquirer's own view.
 *
 * Deliberately narrower than the agent row. `agentNotes` and the assigned agent
 * are the agency's internal triage record *about this person*; Section 5.3
 * grants someone access to their own records, which is not the same as access
 * to the staff annotations on them. Reusing one schema for both audiences was
 * the original mistake — these two views have different readers.
 */
export const MyEnquiryWithPropertySchema = EnquiryResponseSchema.omit({
  assignedAgentId: true,
  assignedAgent: true,
  agentNotes: true,
}).extend({
  property: PropertySummarySchema,
});

export const MyEnquiryListResponseSchema = z.array(MyEnquiryWithPropertySchema);

/** `PATCH /enquiries/:id` — agent triage. */
export const EnquiryUpdateSchema = atLeastOneField(
  z.object({
    status: EnquiryStatusSchema.optional(),
    assignedAgentId: UuidSchema.nullable().optional(),
    agentNotes: z.string().trim().max(4000).nullable().optional(),
  }),
);

export const EnquiryListQuerySchema = PaginationQuerySchema.extend({
  status: optionalParam(EnquiryStatusSchema),
  propertyId: optionalParam(UuidSchema),
  assignedAgentId: optionalParam(UuidSchema),
  q: optionalParam(z.string().trim().min(1).max(160)),
});

// --- Site visits ------------------------------------------------------------

/**
 * `POST /properties/:id/site-visits` — authenticated.
 * The "not in the past" rule is a service-level business rule, not a format
 * rule, so it is enforced in the visits service rather than here.
 */
export const SiteVisitCreateSchema = z.object({
  preferredDate: IsoDateSchema,
  preferredSlot: VisitSlotSchema,
  contactPhone: PhoneSchema.optional(),
});

export const SiteVisitResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  userId: UuidSchema,
  preferredDate: IsoDateSchema,
  preferredSlot: VisitSlotSchema,
  contactPhone: z.string().nullable(),
  status: VisitStatusSchema,
  confirmedAt: IsoDateTimeSchema.nullable(),
  agentNotes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

/** Row shape for `GET /site-visits` — the agent queue. */
export const SiteVisitWithPropertySchema = SiteVisitResponseSchema.extend({
  property: PropertySummarySchema,
});

export const SiteVisitListResponseSchema = z.array(SiteVisitWithPropertySchema);

/**
 * Row shape for `GET /me/site-visits` — the requester's own view.
 *
 * `confirmedAt` stays: the visitor needs to know their slot was confirmed.
 * `agentNotes` goes: it is the agency's internal record about the visit.
 */
export const MySiteVisitWithPropertySchema = SiteVisitResponseSchema.omit({
  agentNotes: true,
}).extend({
  property: PropertySummarySchema,
});

export const MySiteVisitListResponseSchema = z.array(MySiteVisitWithPropertySchema);

/** `PATCH /site-visits/:id` — agent confirms, completes or annotates. */
export const SiteVisitUpdateSchema = atLeastOneField(
  z.object({
    status: VisitStatusSchema.optional(),
    preferredDate: IsoDateSchema.optional(),
    preferredSlot: VisitSlotSchema.optional(),
    agentNotes: z.string().trim().max(4000).nullable().optional(),
  }),
);

export const SiteVisitListQuerySchema = PaginationQuerySchema.extend({
  status: optionalParam(VisitStatusSchema),
  propertyId: optionalParam(UuidSchema),
  from: optionalParam(IsoDateSchema),
  to: optionalParam(IsoDateSchema),
});

// --- Saved properties -------------------------------------------------------

export const SavedPropertyResponseSchema = z.object({
  userId: UuidSchema,
  propertyId: UuidSchema,
  createdAt: IsoDateTimeSchema,
});

/** Row shape for `GET /me/saved`. */
export const SavedPropertyWithPropertySchema = SavedPropertyResponseSchema.extend({
  property: PropertySummarySchema,
});

export const SavedPropertyListResponseSchema = z.array(SavedPropertyWithPropertySchema);

// --- Interest registrations (group purchase) --------------------------------

/**
 * `POST /properties/:id/interest` — registers an expression of interest. It
 * creates no commitment and moves no money; the agency follows up by phone or
 * email (Section 1.3).
 */
export const InterestCreateSchema = z.object({
  indicativeAmount: PositiveMoneySchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const InterestResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  userId: UuidSchema,
  indicativeAmount: PositiveMoneySchema.nullable(),
  notes: z.string().nullable(),
  status: InterestStatusSchema,
  agentNotes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

/** Row shape for `GET /interests` — the agent follow-up queue. */
export const InterestWithPropertySchema = InterestResponseSchema.extend({
  property: PropertySummarySchema,
});

export const InterestListResponseSchema = z.array(InterestWithPropertySchema);

/**
 * Row shape for `GET /me/interests` — the registrant's own view.
 *
 * `agentNotes` is the agency's internal follow-up record and is omitted. The
 * registrant still sees their own `indicativeAmount`, `notes` and `status`.
 */
export const MyInterestWithPropertySchema = InterestResponseSchema.omit({
  agentNotes: true,
}).extend({
  property: PropertySummarySchema,
});

export const MyInterestListResponseSchema = z.array(MyInterestWithPropertySchema);

/** `PATCH /interests/:id` — agent follow-up queue. */
export const InterestUpdateSchema = atLeastOneField(
  z.object({
    status: InterestStatusSchema.optional(),
    agentNotes: z.string().trim().max(4000).nullable().optional(),
  }),
);

export const InterestListQuerySchema = PaginationQuerySchema.extend({
  status: optionalParam(InterestStatusSchema),
  propertyId: optionalParam(UuidSchema),
});
