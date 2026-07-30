import { Router } from 'express';
import {
  IdParamSchema,
  PropertyAdminListQuerySchema,
  PropertyCreateSchema,
  PropertyListQuerySchema,
  PropertyMapQuerySchema,
  PropertyUpdateSchema,
  SlugParamSchema,
} from '../../contracts/index.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, optionalAuthenticate, requireAdmin, requireAgent } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as propertiesController from './properties.controller.js';

/**
 * `/properties` routes (Section 5.2).
 *
 * Route order matters: `/properties/map` shares a segment count with
 * `/properties/:slug`, so it must be registered first or Express would match
 * the literal word "map" as a slug value. `/properties/admin/list` is
 * registered alongside it for the same reason, even though its extra segment
 * means it would not actually collide.
 */
export const propertiesRoutes = Router();

propertiesRoutes.get(
  '/properties/map',
  validate({ query: PropertyMapQuerySchema }),
  asyncHandler(propertiesController.getPropertiesMap),
);

propertiesRoutes.get(
  '/properties/admin/list',
  authenticate,
  requireAgent,
  validate({ query: PropertyAdminListQuerySchema }),
  asyncHandler(propertiesController.listAdminProperties),
);

propertiesRoutes.get(
  '/properties',
  validate({ query: PropertyListQuerySchema }),
  asyncHandler(propertiesController.listProperties),
);

propertiesRoutes.get(
  '/properties/:slug',
  optionalAuthenticate,
  validate({ params: SlugParamSchema }),
  asyncHandler(propertiesController.getPropertyBySlug),
);

propertiesRoutes.post(
  '/properties',
  authenticate,
  requireAgent,
  validate({ body: PropertyCreateSchema }),
  asyncHandler(propertiesController.createProperty),
);

propertiesRoutes.patch(
  '/properties/:id',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema, body: PropertyUpdateSchema }),
  asyncHandler(propertiesController.updateProperty),
);

propertiesRoutes.post(
  '/properties/:id/publish',
  authenticate,
  requireAgent,
  validate({ params: IdParamSchema }),
  asyncHandler(propertiesController.publishProperty),
);

propertiesRoutes.delete(
  '/properties/:id',
  authenticate,
  requireAdmin,
  validate({ params: IdParamSchema }),
  asyncHandler(propertiesController.deleteProperty),
);
