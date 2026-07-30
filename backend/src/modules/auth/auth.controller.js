import { AuthResponseSchema, MeResponseSchema } from '../../contracts/index.js';
import { UnauthenticatedError } from '../../utils/app-error.js';
import * as authService from './auth.service.js';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from './auth.helpers.js';

/**
 * Thin HTTP handlers for `/auth/*` — validate has already run, so every
 * handler just calls the service and shapes the response (Section 9.2). The
 * refresh token never appears in a response body; it only ever travels as the
 * httpOnly cookie set here.
 */

/**
 * POST /auth/register
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const registerHandler = async (req, res) => {
  const { refreshToken, ...session } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ data: AuthResponseSchema.parse(session), meta: {} });
};

/**
 * POST /auth/login
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const loginHandler = async (req, res) => {
  const { refreshToken, ...session } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ data: AuthResponseSchema.parse(session), meta: {} });
};

/**
 * POST /auth/refresh
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const refreshHandler = async (req, res) => {
  const presented = readRefreshToken(req);
  if (!presented) {
    throw new UnauthenticatedError('Sign in to continue.');
  }

  const { refreshToken, ...session } = await authService.refresh(presented);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ data: AuthResponseSchema.parse(session), meta: {} });
};

/**
 * POST /auth/logout
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const logoutHandler = async (req, res) => {
  const presented = readRefreshToken(req);
  await authService.logout({ userId: req.user.id, refreshToken: presented });
  clearRefreshCookie(res);
  res.status(200).json({ data: null, meta: {} });
};

/**
 * GET /auth/me
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const getMeHandler = async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.status(200).json({ data: MeResponseSchema.parse(user), meta: {} });
};

/**
 * PATCH /auth/me
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export const updateMeHandler = async (req, res) => {
  const user = await authService.updateMe(req.user.id, req.body);
  res.status(200).json({ data: MeResponseSchema.parse(user), meta: {} });
};
