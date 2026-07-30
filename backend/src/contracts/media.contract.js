import { z } from 'zod';
import { MediaTypeSchema } from './enums.js';
import { atLeastOneField, IsoDateTimeSchema, UuidSchema } from './common.contract.js';

/**
 * Property media and the upload rules from Section 5.2.
 *
 * `storageKey` is deliberately absent from every response schema: it is an
 * internal object-storage path and clients only ever need `url`.
 */

/**
 * Accepted upload MIME types (Section 5.2), mapped to the MediaType they produce.
 *
 * This list is matched against the **client-declared** type, which is a first
 * filter rather than proof of content. Magic-byte sniffing was considered and
 * deliberately not added: the stored extension comes from this allowlist rather
 * than the uploaded filename, keys are `randomUUID()`, the client filename never
 * reaches a path, and local uploads are served with `nosniff` and a
 * `Content-Disposition`, so a mislabelled file lands as inert bytes with no
 * execution path. The trust boundary that actually matters is the agent account,
 * and an attacker holding one can do considerably worse than mislabel a file.
 * Revisit in the WP13 hardening pass if defence in depth is wanted.
 */
export const ACCEPTED_MIME_TYPES = Object.freeze({
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'video/mp4': 'VIDEO',
  'application/pdf': 'DOCUMENT',
});

export const AcceptedMimeTypeSchema = z.enum(Object.keys(ACCEPTED_MIME_TYPES));

/**
 * Multipart limits: max 10 files, 10 MB each (Section 5.2).
 *
 * Reviewed and kept deliberately. 10 x 10 MB bounds one request to roughly
 * 100 MB held in memory, because `multer.memoryStorage()` buffers the whole
 * batch before the storage adapter places it. That is acceptable here: the
 * endpoint is agent-only rather than public, 10 MB comfortably fits the actual
 * content (phone photographs, a short walkthrough clip, a scanned deed) without
 * being loose enough to invite abuse, and the real ceiling on concurrent
 * worst-cases is per-instance memory and concurrency, which is a deployment
 * setting (WP12) rather than something these numbers can control.
 */
export const UPLOAD_LIMITS = Object.freeze({
  maxFiles: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
  /** Multipart field name for the media endpoints. */
  fieldName: 'files',
  /** Multipart field name for the single-file endpoints (snapshots). */
  singleFieldName: 'file',
});

export const PropertyMediaResponseSchema = z.object({
  id: UuidSchema,
  propertyId: UuidSchema,
  type: MediaTypeSchema,
  url: z.string().min(1),
  caption: z.string().nullable(),
  sortOrder: z.number().int(),
  isCover: z.boolean(),
  createdAt: IsoDateTimeSchema,
});

export const PropertyMediaListResponseSchema = z.array(PropertyMediaResponseSchema);

/**
 * `PATCH /media/:id`. Setting `isCover` to true must clear the flag on the
 * property's other media — a partial unique index enforces one cover per
 * property at the database level.
 */
export const MediaUpdateSchema = atLeastOneField(
  z.object({
    caption: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
    isCover: z.boolean().optional(),
  }),
);

/** Optional per-upload metadata sent alongside the files as multipart fields. */
export const MediaUploadFieldsSchema = z.object({
  caption: z.string().trim().max(255).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});
