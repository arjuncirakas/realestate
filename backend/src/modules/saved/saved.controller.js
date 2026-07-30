import { SavedPropertyListResponseSchema, SavedPropertyResponseSchema } from '../../contracts/index.js';
import * as savedService from './saved.service.js';

/**
 * Thin controllers for the saved-properties endpoints (Section 5.2). Every
 * outbound payload is `.parse()`d through its contract schema before it
 * reaches `res.json`, so a serializer leak fails loudly instead of silently
 * shipping an extra field.
 */

/**
 * `GET /me/saved` — the caller's shortlist, paginated.
 * @type {import('express').RequestHandler}
 */
export const listMySaved = async (req, res) => {
  const { rows, meta } = await savedService.listMySaved({ ...req.query, userId: req.user.id });
  res.json({ data: SavedPropertyListResponseSchema.parse(rows), meta });
};

/**
 * `POST /me/saved/:propertyId` — idempotent save.
 * @type {import('express').RequestHandler}
 */
export const saveProperty = async (req, res) => {
  const saved = await savedService.saveProperty({
    userId: req.user.id,
    propertyId: req.params.propertyId,
  });
  res.status(200).json({ data: SavedPropertyResponseSchema.parse(saved), meta: {} });
};

/**
 * `DELETE /me/saved/:propertyId` — removes a plot from the shortlist.
 * @type {import('express').RequestHandler}
 */
export const unsaveProperty = async (req, res) => {
  const saved = await savedService.unsaveProperty({
    userId: req.user.id,
    propertyId: req.params.propertyId,
  });
  res.json({ data: SavedPropertyResponseSchema.parse(saved), meta: {} });
};
