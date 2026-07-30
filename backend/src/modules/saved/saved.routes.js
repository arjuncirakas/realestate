import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { PaginationQuerySchema, PropertyIdParamSchema } from '../../contracts/index.js';
import * as savedController from './saved.controller.js';

/**
 * Routes for `/me/saved` (Section 5.2). Full sub-paths are declared here so
 * `app.js` needs only one `app.use(API_PREFIX, savedRoutes)` line
 * (Section 13.1).
 */
export const savedRoutes = Router();

savedRoutes.get(
  '/me/saved',
  authenticate,
  validate({ query: PaginationQuerySchema }),
  asyncHandler(savedController.listMySaved),
);

savedRoutes.post(
  '/me/saved/:propertyId',
  authenticate,
  validate({ params: PropertyIdParamSchema }),
  asyncHandler(savedController.saveProperty),
);

savedRoutes.delete(
  '/me/saved/:propertyId',
  authenticate,
  validate({ params: PropertyIdParamSchema }),
  asyncHandler(savedController.unsaveProperty),
);
