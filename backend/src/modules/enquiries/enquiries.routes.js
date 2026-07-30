import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, optionalAuthenticate, requireAgent } from '../../middleware/auth.js';
import { enquiryRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import {
  EnquiryCreateSchema,
  EnquiryListQuerySchema,
  EnquiryUpdateSchema,
  IdParamSchema,
} from '../../contracts/index.js';
import * as enquiriesController from './enquiries.controller.js';

/**
 * Routes for `/properties/:id/enquiries`, `/enquiries` and `/me/enquiries`
 * (Section 5.2). Full sub-paths are declared here so `app.js` needs only one
 * `app.use(API_PREFIX, enquiryRoutes)` line (Section 13.1).
 */
export const enquiryRoutes = Router();

enquiryRoutes.post(
  '/properties/:id/enquiries',
  enquiryRateLimiter,
  optionalAuthenticate,
  validate({ params: IdParamSchema, body: EnquiryCreateSchema }),
  asyncHandler(enquiriesController.createEnquiry),
);

enquiryRoutes.get(
  '/enquiries',
  authenticate,
  requireAgent,
  validate({ query: EnquiryListQuerySchema }),
  asyncHandler(enquiriesController.listEnquiries),
);

enquiryRoutes.patch(
  '/enquiries/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: EnquiryUpdateSchema }),
  asyncHandler(enquiriesController.updateEnquiry),
);

enquiryRoutes.get(
  '/me/enquiries',
  authenticate,
  validate({ query: EnquiryListQuerySchema }),
  asyncHandler(enquiriesController.listMyEnquiries),
);
