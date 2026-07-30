import { z } from 'zod';
import { IsoDateTimeSchema } from './common.contract.js';

/**
 * The response envelope and error vocabulary from Section 5.1. Every response
 * the API emits — success or failure — matches one of the shapes here.
 */

const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
];

export const ErrorCode = Object.freeze(Object.fromEntries(ERROR_CODES.map((c) => [c, c])));
export const ErrorCodeSchema = z.enum(ERROR_CODES);

/** HTTP status for each error code (Section 5.1). */
export const ERROR_STATUS_BY_CODE = Object.freeze({
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
});

export const ErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    details: z.array(ErrorDetailSchema).optional(),
  }),
});

export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

/**
 * Wraps a payload schema in the success envelope `{ data, meta }`.
 * @param {import('zod').ZodTypeAny} dataSchema
 * @param {import('zod').ZodTypeAny} [metaSchema] defaults to a free-form object
 * @returns {import('zod').ZodObject<any>}
 */
export const successEnvelope = (dataSchema, metaSchema) =>
  z.object({
    data: dataSchema,
    meta: (metaSchema ?? z.record(z.string(), z.unknown())).default({}),
  });

/**
 * Wraps an item schema in the paginated envelope `{ data: [], meta: {...} }`.
 * @param {import('zod').ZodTypeAny} itemSchema
 * @returns {import('zod').ZodObject<any>}
 */
export const paginatedEnvelope = (itemSchema) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });

/** Payload of `GET /health`. Liveness only — it does not touch the database. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: IsoDateTimeSchema,
});
