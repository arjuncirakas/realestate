import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './users.routes.js';

/**
 * Combined router for the whole auth module — `/auth/*` and `/users/*` — so
 * `app.js` needs only the single `app.use()` line Section 13.1 allows it.
 */
export const authModuleRoutes = Router();
authModuleRoutes.use(authRoutes);
authModuleRoutes.use(userRoutes);
