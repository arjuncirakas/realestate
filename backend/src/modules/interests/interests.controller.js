import {
  InterestListResponseSchema,
  InterestResponseSchema,
  MyInterestListResponseSchema,
} from '../../contracts/index.js';
import * as interestsService from './interests.service.js';

/**
 * Thin controllers for the interest-registration endpoints (Section 5.2).
 * This is a group-purchase expression-of-interest register only
 * (Section 1.3); every message here uses "register interest" language. Every
 * outbound payload is `.parse()`d through its contract schema before it
 * reaches `res.json`, so a serializer leak fails loudly instead of silently
 * shipping an extra field.
 */

/**
 * `POST /properties/:id/interest` — registers an expression of interest. The
 * session-derived fields are spread last so a client cannot smuggle its own
 * `propertyId`/`userId` through the body and win the merge.
 * @type {import('express').RequestHandler}
 */
export const registerInterest = async (req, res) => {
  const interest = await interestsService.registerInterest({
    ...req.body,
    propertyId: req.params.id,
    userId: req.user.id,
  });
  res.status(201).json({ data: InterestResponseSchema.parse(interest), meta: {} });
};

/**
 * `GET /me/interests` — the caller's own registrations.
 * @type {import('express').RequestHandler}
 */
export const listMyInterests = async (req, res) => {
  const { rows, meta } = await interestsService.listMyInterests({
    ...req.query,
    userId: req.user.id,
  });
  res.json({ data: MyInterestListResponseSchema.parse(rows), meta });
};

/**
 * `PATCH /me/interests/:id/withdraw` — own-record-only.
 * @type {import('express').RequestHandler}
 */
export const withdrawMyInterest = async (req, res) => {
  const interest = await interestsService.withdrawMyInterest({
    id: req.params.id,
    userId: req.user.id,
  });
  res.json({ data: InterestResponseSchema.parse(interest), meta: {} });
};

/**
 * `GET /interests` — agent follow-up queue.
 * @type {import('express').RequestHandler}
 */
export const listInterestsForAgent = async (req, res) => {
  const { rows, meta } = await interestsService.listInterestsForAgent(req.query);
  res.json({ data: InterestListResponseSchema.parse(rows), meta });
};

/**
 * `PATCH /interests/:id` — agent follow-up: status, notes. The route id is
 * spread last so a stray `id` field in the body cannot override it.
 * @type {import('express').RequestHandler}
 */
export const updateInterestForAgent = async (req, res) => {
  const interest = await interestsService.updateInterestForAgent({
    ...req.body,
    id: req.params.id,
  });
  res.json({ data: InterestResponseSchema.parse(interest), meta: {} });
};
