import {
  OwnedPropertyDetailSchema,
  OwnedPropertyListResponseSchema,
  OwnershipResponseSchema,
} from '../../contracts/index.js';
import * as ownershipService from './ownership.service.js';

/**
 * Thin controllers for ownership records and the owner-facing `/me/properties`
 * views (Section 5.2). Every outbound payload is `.parse()`d through its
 * contract schema before it reaches `res.json`.
 */

/**
 * `GET /me/properties`.
 * @type {import('express').RequestHandler}
 */
export const listMyProperties = async (req, res) => {
  const { rows, meta } = await ownershipService.listMyProperties({
    ...req.query,
    userId: req.user.id,
  });
  res.json({ data: OwnedPropertyListResponseSchema.parse(rows), meta });
};

/**
 * `GET /me/properties/:id`.
 * @type {import('express').RequestHandler}
 */
export const getMyPropertyDetail = async (req, res) => {
  const detail = await ownershipService.getMyPropertyDetail({
    propertyId: req.params.id,
    userId: req.user.id,
  });
  res.json({ data: OwnedPropertyDetailSchema.parse(detail), meta: {} });
};

/**
 * `POST /properties/:id/ownerships` — the route id is spread last so a
 * stray `propertyId` in the body cannot override it.
 * @type {import('express').RequestHandler}
 */
export const createOwnership = async (req, res) => {
  const ownership = await ownershipService.createOwnership({
    ...req.body,
    propertyId: req.params.id,
  });
  res.status(201).json({ data: OwnershipResponseSchema.parse(ownership), meta: {} });
};

/**
 * `PATCH /ownerships/:id`.
 * @type {import('express').RequestHandler}
 */
export const updateOwnership = async (req, res) => {
  const ownership = await ownershipService.updateOwnership({
    ...req.body,
    id: req.params.id,
  });
  res.json({ data: OwnershipResponseSchema.parse(ownership), meta: {} });
};

/**
 * `DELETE /ownerships/:id`.
 * @type {import('express').RequestHandler}
 */
export const deleteOwnership = async (req, res) => {
  await ownershipService.deleteOwnership({ id: req.params.id });
  res.status(204).end();
};
