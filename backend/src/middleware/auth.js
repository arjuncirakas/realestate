import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '../contracts/index.js';
import { ForbiddenError, UnauthenticatedError } from '../utils/app-error.js';

/**
 * JWT verification and role checks.
 *
 * This middleware only trusts the signed token — it deliberately does not read
 * the database. An access token lives 15 minutes (Section 6), which bounds how
 * long a deactivated account stays usable, and the alternative is a query on
 * every single request. Endpoints that must react immediately to deactivation
 * should re-check `isActive` in their service.
 */

/**
 * Pulls a bearer token out of the Authorization header.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
const readBearerToken = (req) => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
};

/**
 * Verifies an access token and returns its claims.
 * @param {string} token
 * @returns {{ id: string, role: string }}
 * @throws {UnauthenticatedError} on a missing, malformed, expired or wrongly signed token
 */
const verifyAccessToken = (token) => {
  try {
    // Pinning the algorithm matters: without it a token signed with "none"
    // would be accepted.
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (!payload?.sub || !payload?.role) {
      throw new UnauthenticatedError('Your session is not valid. Sign in again.');
    }
    return { id: payload.sub, role: payload.role };
  } catch (error) {
    if (error instanceof UnauthenticatedError) throw error;
    if (error.name === 'TokenExpiredError') {
      throw new UnauthenticatedError('Your session has expired. Sign in again.');
    }
    throw new UnauthenticatedError('Your session is not valid. Sign in again.');
  }
};

/**
 * Requires a valid access token and sets `req.user`.
 * @type {import('express').RequestHandler}
 */
export const authenticate = (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    next(new UnauthenticatedError('Sign in to continue.'));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Sets `req.user` when a valid token is present and continues regardless.
 *
 * For endpoints that are public but behave differently for a signed-in visitor —
 * a guest enquiry that should be attributed to an account when there is one
 * (Section 4.2), or a listing that shows whether the viewer has saved it.
 * An invalid token is ignored rather than rejected, so an expired session never
 * breaks a public page.
 *
 * @type {import('express').RequestHandler}
 */
export const optionalAuthenticate = (req, res, next) => {
  const token = readBearerToken(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
};

/**
 * Restricts a route to the given roles. Must sit after `authenticate`.
 * @param {...string} roles allowed values from `UserRole`
 * @returns {import('express').RequestHandler}
 */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      next(new UnauthenticatedError('Sign in to continue.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('You do not have access to this.'));
      return;
    }
    next();
  };

/** Agents and admins — listings, media, queues, ownership records (Section 5.3). */
export const requireAgent = requireRole(UserRole.AGENT, UserRole.ADMIN);

/** Admins only — user management and hard deletes (Section 5.3). */
export const requireAdmin = requireRole(UserRole.ADMIN);
