import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { API_PREFIX, BCRYPT_COST } from '../../config/constants.js';
import { toIsoDateTime } from '../../utils/serialize.js';

/**
 * Token issuance, cookie handling and the User -> wire-shape mapping shared by
 * `auth.service.js` and `users.service.js` (Section 6).
 */

/** Name of the httpOnly cookie carrying the refresh token. Never present in a JSON body. */
export const REFRESH_COOKIE_NAME = 'refreshToken';

// Scoped to the auth routes only: nothing else needs the refresh token, so
// there is no reason for the browser to attach it to every request.
const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

const TTL_UNIT_SECONDS = Object.freeze({ s: 1, m: 60, h: 3600, d: 86400 });

/**
 * Parses a "15m" / "2h" / "7d" style TTL string (the format `ACCESS_TOKEN_TTL`
 * is validated against in `config/env.js`) into whole seconds.
 * @param {string} ttl
 * @returns {number}
 */
export const parseTtlSeconds = (ttl) => {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  return Number(match[1]) * TTL_UNIT_SECONDS[match[2]];
};

/** Seconds until an access token expires, for `AuthResponseSchema.accessTokenExpiresIn`. */
export const ACCESS_TOKEN_TTL_SECONDS = parseTtlSeconds(env.ACCESS_TOKEN_TTL);

/**
 * Hashes a plaintext password at the configured bcrypt cost (Section 6).
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

/**
 * Compares a plaintext password against a stored hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

/**
 * A bcrypt hash of a value nobody will ever type, so `login` can run a
 * `bcrypt.compare` even when no account matches the given email. Without this,
 * a request for an unknown email would return faster than one for a known
 * email with the wrong password, which is a timing oracle for account
 * enumeration.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-account-has-this-password-000', BCRYPT_COST);

/**
 * Signs a 15-minute access token, payload `{ sub, role, iat, exp }` (Section 6).
 * @param {{ id: string, role: string }} user
 * @returns {string}
 */
export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL,
  });

/**
 * Generates a new opaque refresh token plus the SHA-256 hash that is persisted
 * (Section 6) — the raw token itself is never stored.
 * @returns {{ token: string, tokenHash: string }}
 */
export const generateRefreshToken = () => {
  const token = crypto.randomBytes(64).toString('hex');
  return { token, tokenHash: hashRefreshToken(token) };
};

/**
 * SHA-256 of a refresh token, used both to store it and to look it up.
 * @param {string} token
 * @returns {string}
 */
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * The `expires_at` to store for a freshly issued refresh token.
 * @returns {Date}
 */
export const refreshTokenExpiryDate = () =>
  new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

/** Cookie attributes shared by `set` and `clear`, so they can never drift apart. */
const refreshCookieOptions = () => ({
  httpOnly: true,
  // Literally "secure" per Section 6, but a cookie marked secure is dropped by
  // every browser over plain http — including this project's own dev setup
  // (CORS_ORIGIN=http://localhost:5173, Section 8.1). Restricting it to
  // production keeps the guarantee where it matters and keeps `npm run dev`
  // working locally.
  secure: env.isProduction,
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
});

/**
 * Sets the refresh-token cookie on a response. The token is never included in
 * a JSON response body (Section 6).
 * @param {import('express').Response} res
 * @param {string} token
 * @returns {void}
 */
export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
};

/**
 * Clears the refresh-token cookie, e.g. on logout.
 * @param {import('express').Response} res
 * @returns {void}
 */
export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
};

/**
 * Reads the refresh token from the cookie, falling back to the request body
 * for non-browser clients (Section 5.2).
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export const readRefreshToken = (req) =>
  req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken ?? null;

/**
 * Maps a Prisma `User` row to `UserResponseSchema`. `passwordHash` is never
 * included (Section 9.1 of `docs/API.md`).
 * @param {{ id: string, email: string, phone: string | null, fullName: string, role: string, isActive: boolean, createdAt: Date, updatedAt: Date }} user
 * @returns {{ id: string, email: string, phone: string | null, fullName: string, role: string, isActive: boolean, createdAt: string, updatedAt: string }}
 */
export const toUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  fullName: user.fullName,
  role: user.role,
  isActive: user.isActive,
  createdAt: toIsoDateTime(user.createdAt),
  updatedAt: toIsoDateTime(user.updatedAt),
});
