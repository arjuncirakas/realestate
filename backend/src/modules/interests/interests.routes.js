import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, requireAgent } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  IdParamSchema,
  InterestCreateSchema,
  InterestListQuerySchema,
  InterestUpdateSchema,
} from '../../contracts/index.js';
import * as interestsController from './interests.controller.js';

/**
 * Routes for `/properties/:id/interest`, `/interests` and `/me/interests`
 * (Section 5.2). Full sub-paths are declared here so `app.js` needs only one
 * `app.use(API_PREFIX, interestRoutes)` line (Section 13.1). This is a
 * group-purchase expression-of-interest register only (Section 1.3).
 */
export const interestRoutes = Router();

interestRoutes.post(
  '/properties/:id/interest',
  authenticate,
  validate({ params: IdParamSchema, body: InterestCreateSchema }),
  asyncHandler(interestsController.registerInterest),
);

interestRoutes.get(
  '/me/interests',
  authenticate,
  validate({ query: InterestListQuerySchema }),
  asyncHandler(interestsController.listMyInterests),
);

interestRoutes.patch(
  '/me/interests/:id/withdraw',
  authenticate,
  validate({ params: IdParamSchema }),
  asyncHandler(interestsController.withdrawMyInterest),
);

interestRoutes.get(
  '/interests',
  authenticate,
  requireAgent,
  validate({ query: InterestListQuerySchema }),
  asyncHandler(interestsController.listInterestsForAgent),
);

interestRoutes.patch(
  '/interests/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: InterestUpdateSchema }),
  asyncHandler(interestsController.updateInterestForAgent),
);
