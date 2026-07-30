import {
  MySiteVisitListResponseSchema,
  SiteVisitListResponseSchema,
  SiteVisitResponseSchema,
} from '../../contracts/index.js';
import * as visitsService from './visits.service.js';

/**
 * Thin controllers for the site visit endpoints (Section 5.2): validation has
 * already run in the route, so these only translate `req` into service
 * arguments and shape the envelope. Every outbound payload is `.parse()`d
 * through its contract schema before it reaches `res.json`, so a serializer
 * leak fails loudly instead of silently shipping an extra field.
 */

/**
 * `POST /properties/:id/site-visits` — authenticated. The session-derived
 * fields are spread last so a client cannot smuggle its own
 * `propertyId`/`userId` through the body and win the merge.
 * @type {import('express').RequestHandler}
 */
export const createSiteVisit = async (req, res) => {
  const visit = await visitsService.createSiteVisit({
    ...req.body,
    propertyId: req.params.id,
    userId: req.user.id,
  });
  res.status(201).json({ data: SiteVisitResponseSchema.parse(visit), meta: {} });
};

/**
 * `GET /me/site-visits` — the caller's own requests.
 * @type {import('express').RequestHandler}
 */
export const listMySiteVisits = async (req, res) => {
  const { rows, meta } = await visitsService.listMySiteVisits({
    ...req.query,
    userId: req.user.id,
  });
  res.json({ data: MySiteVisitListResponseSchema.parse(rows), meta });
};

/**
 * `PATCH /me/site-visits/:id/cancel` — own-record-only.
 * @type {import('express').RequestHandler}
 */
export const cancelMySiteVisit = async (req, res) => {
  const visit = await visitsService.cancelMySiteVisit({ id: req.params.id, userId: req.user.id });
  res.json({ data: SiteVisitResponseSchema.parse(visit), meta: {} });
};

/**
 * `GET /site-visits` — agent queue.
 * @type {import('express').RequestHandler}
 */
export const listSiteVisitsForAgent = async (req, res) => {
  const { rows, meta } = await visitsService.listSiteVisitsForAgent(req.query);
  res.json({ data: SiteVisitListResponseSchema.parse(rows), meta });
};

/**
 * `PATCH /site-visits/:id` — agent confirms, completes or annotates. The
 * route id is spread last so a stray `id` field in the body cannot override it.
 * @type {import('express').RequestHandler}
 */
export const updateSiteVisitForAgent = async (req, res) => {
  const visit = await visitsService.updateSiteVisitForAgent({ ...req.body, id: req.params.id });
  res.json({ data: SiteVisitResponseSchema.parse(visit), meta: {} });
};
