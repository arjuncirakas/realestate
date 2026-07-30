import { PropertyMediaListResponseSchema, PropertyMediaResponseSchema } from '../../contracts/index.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { deleteMedia, updateMedia, uploadPropertyMedia } from './media.service.js';

/**
 * Thin HTTP layer for property media (Section 5.2). Validation already ran in
 * the router; these handlers only translate the request into a service call
 * and shape the response.
 */

/**
 * `POST /properties/:id/media` — upload up to 10 files to a property's
 * gallery.
 * @type {import('express').RequestHandler}
 */
export const uploadMedia = asyncHandler(async (req, res) => {
  const media = await uploadPropertyMedia({
    propertyId: req.params.id,
    files: req.files,
    fields: req.body,
  });
  res.status(201).json({ data: PropertyMediaListResponseSchema.parse(media), meta: {} });
});

/**
 * `PATCH /media/:id` — caption, sort order and/or cover status.
 * @type {import('express').RequestHandler}
 */
export const patchMedia = asyncHandler(async (req, res) => {
  const media = await updateMedia({ mediaId: req.params.id, patch: req.body });
  res.json({ data: PropertyMediaResponseSchema.parse(media), meta: {} });
});

/**
 * `DELETE /media/:id`.
 * @type {import('express').RequestHandler}
 */
export const removeMedia = asyncHandler(async (req, res) => {
  await deleteMedia({ mediaId: req.params.id });
  res.status(204).end();
});
