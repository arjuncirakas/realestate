import { Router } from 'express';
import { AdminUserUpdateSchema, IdParamSchema, UserListQuerySchema } from '../../contracts/index.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listUsersHandler, updateUserHandler } from './users.controller.js';

/** `/users/*` — Section 5.2, admin only. */
export const userRoutes = Router();

userRoutes.get(
  '/users',
  authenticate,
  requireAdmin,
  validate({ query: UserListQuerySchema }),
  asyncHandler(listUsersHandler),
);

userRoutes.patch(
  '/users/:id',
  authenticate,
  requireAdmin,
  validate({ params: IdParamSchema, body: AdminUserUpdateSchema }),
  asyncHandler(updateUserHandler),
);
