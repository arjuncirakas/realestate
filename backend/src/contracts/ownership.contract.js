import { z } from 'zod';
import { LogTypeSchema } from './enums.js';
import {
  atLeastOneField,
  IsoDateSchema,
  IsoDateTimeSchema,
  optionalParam,
  PaginationQuerySchema,
  SharePercentageSchema,
  UuidSchema,
} from './common.contract.js';
import { PropertyResponseSchema, PropertySummarySchema } from './property.contract.js';
import { UserSummarySchema } from './auth.contract.js';

/**
 * Ownership records, the agency's management log, and the site photo timeline —
 * the `/me/properties`, `/ownerships`, `/logs` and `/snapshots` endpoints in
 * Section 5.2.
 */

// --- Ownerships -------------------------------------------------------------

/**
 * `POST /properties/:id/ownerships` — agent only. Total share across a property
 * must not exceed 100%; that sum is checked in the ownership service, since no
 * single row can see the others (Section 4.2).
 */
export const OwnershipCreateSchema = z.object({
  ownerUserId: UuidSchema,
  sharePercentage: SharePercentageSchema.optional(),
  registeredOn: IsoDateSchema.nullable().optional(),
  documentRef: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const OwnershipUpdateSchema = atLeastOneField(OwnershipCreateSchema.partial());

export const OwnershipResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  ownerUserId: UuidSchema,
  ownerUser: UserSummarySchema.nullable(),
  sharePercentage: SharePercentageSchema,
  registeredOn: IsoDateSchema.nullable(),
  documentRef: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const OwnershipListResponseSchema = z.array(OwnershipResponseSchema);

// --- Owner-facing views -----------------------------------------------------

/** Row shape for `GET /me/properties`. */
export const OwnedPropertyListItemSchema = z.object({
  property: PropertySummarySchema,
  ownership: OwnershipResponseSchema,
});

export const OwnedPropertyListResponseSchema = z.array(OwnedPropertyListItemSchema);

/**
 * `GET /me/properties/:id`. `ownerships` lists every share on the plot so a
 * co-owner can see how the 100% is split; `ownership` is the caller's own row.
 */
export const OwnedPropertyDetailSchema = z.object({
  property: PropertyResponseSchema,
  ownership: OwnershipResponseSchema,
  ownerships: z.array(OwnershipResponseSchema),
});

// --- Management logs --------------------------------------------------------

export const ManagementLogMediaResponseSchema = z.object({
  id: UuidSchema,
  logId: UuidSchema,
  url: z.string().min(1),
  caption: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});

/** `POST /properties/:id/logs` — agent records work done on the land. */
export const ManagementLogCreateSchema = z.object({
  logType: LogTypeSchema,
  title: z.string().trim().min(4).max(160),
  notes: z.string().trim().max(4000).nullable().optional(),
  occurredOn: IsoDateSchema,
  isVisibleToOwner: z.boolean().optional(),
});

export const ManagementLogUpdateSchema = atLeastOneField(ManagementLogCreateSchema.partial());

export const ManagementLogResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  agentId: UuidSchema,
  agent: UserSummarySchema.nullable(),
  logType: LogTypeSchema,
  title: z.string(),
  notes: z.string().nullable(),
  occurredOn: IsoDateSchema,
  isVisibleToOwner: z.boolean(),
  media: z.array(ManagementLogMediaResponseSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ManagementLogListResponseSchema = z.array(ManagementLogResponseSchema);

/**
 * `GET /me/properties/:id/logs`.
 *
 * There is deliberately no `includeHidden` parameter. Section 5.2 describes this
 * route as "visible logs only", unconditionally — a log with
 * `isVisibleToOwner: false` is never returned here, whatever the caller's role.
 * An earlier draft of this schema carried the flag on the assumption that an
 * agent-facing log list would want it, but Section 5.2 defines no such endpoint
 * (agents create and patch logs, they do not list them), so the parameter had no
 * consumer and only invited the route to behave differently for different
 * readers. If an agent log list is added later, add the flag back with it.
 */
export const ManagementLogListQuerySchema = PaginationQuerySchema.extend({
  logType: optionalParam(LogTypeSchema),
  from: optionalParam(IsoDateSchema),
  to: optionalParam(IsoDateSchema),
});

/** Optional multipart fields for `POST /logs/:id/media`. */
export const ManagementLogMediaUploadFieldsSchema = z.object({
  caption: z.string().trim().max(255).optional(),
});

// --- Plot snapshots ---------------------------------------------------------

/**
 * `POST /properties/:id/snapshots` — agent uploads one site photograph.
 * `capturedAt` defaults to the time of upload. `source` is fixed to `MANUAL` in
 * the MVP; the column exists so an automated camera feed can write rows later
 * without a migration (Section 4.2).
 */
export const PlotSnapshotCreateSchema = z.object({
  capturedAt: IsoDateTimeSchema.optional(),
});

export const PlotSnapshotResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  capturedAt: IsoDateTimeSchema,
  url: z.string().min(1),
  source: z.string(),
  createdAt: IsoDateTimeSchema,
});

export const PlotSnapshotListResponseSchema = z.array(PlotSnapshotResponseSchema);

/** `GET /me/properties/:id/snapshots` — newest first (Section 5.2). */
export const PlotSnapshotListQuerySchema = PaginationQuerySchema.extend({
  from: optionalParam(IsoDateSchema),
  to: optionalParam(IsoDateSchema),
});
