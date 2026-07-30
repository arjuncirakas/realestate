import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, requireAdmin, requireAgent } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  IdParamSchema,
  OwnershipCreateSchema,
  OwnershipUpdateSchema,
  PaginationQuerySchema,
} from '../../contracts/index.js';
import * as ownershipController from './ownership.controller.js';

/**
 * Routes for `/me/properties`, `/me/properties/:id`, `/properties/:id/ownerships`
 * and `/ownerships/:id` (Section 5.2). Full sub-paths are declared here so
 * `app.js` needs only one `app.use(API_PREFIX, ownershipRoutes)` line
 * (Section 13.1).
 */
export const ownershipRoutes = Router();

ownershipRoutes.get(
  '/me/properties',
  authenticate,
  validate({ query: PaginationQuerySchema }),
  asyncHandler(ownershipController.listMyProperties),
);

ownershipRoutes.get(
  '/me/properties/:id',
  authenticate,
  validate({ params: IdParamSchema }),
  asyncHandler(ownershipController.getMyPropertyDetail),
);

ownershipRoutes.post(
  '/properties/:id/ownerships',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: OwnershipCreateSchema }),
  asyncHandler(ownershipController.createOwnership),
);

ownershipRoutes.patch(
  '/ownerships/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: OwnershipUpdateSchema }),
  asyncHandler(ownershipController.updateOwnership),
);

ownershipRoutes.delete(
  '/ownerships/:id',
  authenticate,
  requireAdmin,
  validate({ params: IdParamSchema }),
  asyncHandler(ownershipController.deleteOwnership),
);
