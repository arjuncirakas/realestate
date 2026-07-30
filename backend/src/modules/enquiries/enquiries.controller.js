import {
  EnquiryListResponseSchema,
  EnquiryResponseSchema,
  MyEnquiryListResponseSchema,
} from '../../contracts/index.js';
import * as enquiriesService from './enquiries.service.js';

/**
 * Thin controllers for the enquiries endpoints (Section 5.2): validate has
 * already run in the route, so these only translate `req` into service
 * arguments and shape the envelope. Every outbound payload is `.parse()`d
 * through its contract schema before it reaches `res.json`, so a serializer
 * leak fails loudly instead of silently shipping an extra field.
 */

/**
 * `POST /properties/:id/enquiries` — public, rate-limited. `optionalAuthenticate`
 * means `req.user` is present only for a signed-in visitor; a guest's enquiry
 * still succeeds with `userId: null`. The session-derived fields are spread
 * last so a client cannot smuggle its own `propertyId`/`userId` through the
 * body and win the merge.
 * @type {import('express').RequestHandler}
 */
export const createEnquiry = async (req, res) => {
  const enquiry = await enquiriesService.createEnquiry({
    ...req.body,
    propertyId: req.params.id,
    userId: req.user?.id ?? null,
  });
  res.status(201).json({ data: EnquiryResponseSchema.parse(enquiry), meta: {} });
};

/**
 * `GET /enquiries` — agent triage queue.
 * @type {import('express').RequestHandler}
 */
export const listEnquiries = async (req, res) => {
  const { rows, meta } = await enquiriesService.listEnquiriesForAgent(req.query);
  res.json({ data: EnquiryListResponseSchema.parse(rows), meta });
};

/**
 * `GET /me/enquiries` — the caller's own enquiry history.
 * @type {import('express').RequestHandler}
 */
export const listMyEnquiries = async (req, res) => {
  const { rows, meta } = await enquiriesService.listMyEnquiries({
    ...req.query,
    userId: req.user.id,
  });
  res.json({ data: MyEnquiryListResponseSchema.parse(rows), meta });
};

/**
 * `PATCH /enquiries/:id` — agent triage: status, assignment, notes. The
 * route id is spread last so a stray `id` field in the body cannot override it.
 * @type {import('express').RequestHandler}
 */
export const updateEnquiry = async (req, res) => {
  const enquiry = await enquiriesService.updateEnquiryForAgent({
    ...req.body,
    id: req.params.id,
  });
  res.json({ data: EnquiryResponseSchema.parse(enquiry), meta: {} });
};
