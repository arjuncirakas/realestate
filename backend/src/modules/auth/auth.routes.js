import { Router } from 'express';
import { LoginSchema, LogoutRequestSchema, MeUpdateSchema, RefreshRequestSchema, RegisterSchema } from '../../contracts/index.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import {
  getMeHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
  updateMeHandler,
} from './auth.controller.js';

/** `/auth/*` — Section 5.2. Public routes are rate-limited per Section 6. */
export const authRoutes = Router();

authRoutes.post(
  '/auth/register',
  authRateLimiter,
  validate({ body: RegisterSchema }),
  asyncHandler(registerHandler),
);

authRoutes.post(
  '/auth/login',
  authRateLimiter,
  validate({ body: LoginSchema }),
  asyncHandler(loginHandler),
);

// Not rate-limited: a refresh happens automatically once per access-token
// lifetime (Section 6's axios interceptor), not on every user keystroke, so it
// does not carry the brute-force risk login and register do.
authRoutes.post('/auth/refresh', validate({ body: RefreshRequestSchema }), asyncHandler(refreshHandler));

authRoutes.post(
  '/auth/logout',
  authenticate,
  validate({ body: LogoutRequestSchema }),
  asyncHandler(logoutHandler),
);

authRoutes.get('/auth/me', authenticate, asyncHandler(getMeHandler));

authRoutes.patch(
  '/auth/me',
  authenticate,
  validate({ body: MeUpdateSchema }),
  asyncHandler(updateMeHandler),
);
