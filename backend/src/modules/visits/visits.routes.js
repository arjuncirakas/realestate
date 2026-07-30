import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, requireAgent } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  IdParamSchema,
  SiteVisitCreateSchema,
  SiteVisitListQuerySchema,
  SiteVisitUpdateSchema,
} from '../../contracts/index.js';
import * as visitsController from './visits.controller.js';

/**
 * Routes for `/properties/:id/site-visits`, `/site-visits` and
 * `/me/site-visits` (Section 5.2). Full sub-paths are declared here so
 * `app.js` needs only one `app.use(API_PREFIX, siteVisitRoutes)` line
 * (Section 13.1).
 */
export const siteVisitRoutes = Router();

siteVisitRoutes.post(
  '/properties/:id/site-visits',
  authenticate,
  validate({ params: IdParamSchema, body: SiteVisitCreateSchema }),
  asyncHandler(visitsController.createSiteVisit),
);

siteVisitRoutes.get(
  '/me/site-visits',
  authenticate,
  validate({ query: SiteVisitListQuerySchema }),
  asyncHandler(visitsController.listMySiteVisits),
);

siteVisitRoutes.patch(
  '/me/site-visits/:id/cancel',
  authenticate,
  validate({ params: IdParamSchema }),
  asyncHandler(visitsController.cancelMySiteVisit),
);

siteVisitRoutes.get(
  '/site-visits',
  authenticate,
  requireAgent,
  validate({ query: SiteVisitListQuerySchema }),
  asyncHandler(visitsController.listSiteVisitsForAgent),
);

siteVisitRoutes.patch(
  '/site-visits/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: SiteVisitUpdateSchema }),
  asyncHandler(visitsController.updateSiteVisitForAgent),
);
