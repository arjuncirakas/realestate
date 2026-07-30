import { prisma } from '../../config/prisma.js';
import { UserRole } from '../../contracts/index.js';
import { ConflictError, UnauthenticatedError } from '../../utils/app-error.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DUMMY_PASSWORD_HASH,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  refreshTokenExpiryDate,
  signAccessToken,
  toUserResponse,
  verifyPassword,
} from './auth.helpers.js';

/**
 * Accounts and sessions (Section 5.2, Section 6): register, login, refresh
 * rotation with family revocation, logout, and the caller's own profile.
 */

/**
 * Issues a fresh access/refresh pair for a user and persists the refresh
 * token's hash. Called after register, login and every successful refresh.
 * @param {{ id: string, role: string }} user
 * @returns {Promise<{ accessToken: string, accessTokenExpiresIn: number, refreshToken: string }>}
 */
const issueSession = async (user) => {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: refreshTokenExpiryDate() },
  });
  return { accessToken, accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS, refreshToken };
};

/**
 * Creates a subscriber account — register never creates an agent or admin —
 * and starts a session for it.
 * @param {{ email: string, password: string, fullName: string, phone?: string }} input
 * @returns {Promise<{ user: object, accessToken: string, accessTokenExpiresIn: number, refreshToken: string }>}
 * @throws {ConflictError} when the email is already registered
 */
export const register = async (input) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
      role: UserRole.SUBSCRIBER,
    },
  });

  const session = await issueSession(user);
  return { user: toUserResponse(user), ...session };
};

/**
 * Verifies credentials and starts a session.
 *
 * A missing account and a wrong password produce the same error and take
 * comparable time (via `DUMMY_PASSWORD_HASH`), so a caller cannot use the
 * response to enumerate which emails are registered.
 *
 * @param {{ email: string, password: string }} input
 * @returns {Promise<{ user: object, accessToken: string, accessTokenExpiresIn: number, refreshToken: string }>}
 * @throws {UnauthenticatedError} on invalid credentials or a deactivated account
 */
export const login = async (input) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    throw new UnauthenticatedError('Invalid email or password.');
  }
  if (!user.isActive) {
    throw new UnauthenticatedError('This account has been deactivated. Contact the agency for help.');
  }

  const session = await issueSession(user);
  return { user: toUserResponse(user), ...session };
};

/**
 * Rotates a refresh token: the presented token is revoked and a new one is
 * issued in its place.
 *
 * Reuse of a token that has already been rotated once is the strongest signal
 * available that it was copied by someone else, so it revokes every other
 * active token belonging to the same user rather than just the one presented
 * (Section 6) — the schema has no per-lineage "family" column, so "the entire
 * family for that user" is read as every session currently open for that user.
 *
 * @param {string} refreshToken
 * @returns {Promise<{ user: object, accessToken: string, accessTokenExpiresIn: number, refreshToken: string }>}
 * @throws {UnauthenticatedError} when the token is unknown, reused, expired, or its owner is deactivated
 */
export const refresh = async (refreshToken) => {
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!stored) {
    throw new UnauthenticatedError('Your session is not valid. Sign in again.');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthenticatedError('Your session has expired. Sign in again.');
  }

  if (!stored.user.isActive) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    throw new UnauthenticatedError('This account has been deactivated. Contact the agency for help.');
  }

  // A conditional write, not a plain update: the WHERE clause is re-checked
  // against the row's current state by the database at write time, so this
  // single statement is what actually decides who wins a race. A `findUnique`
  // followed by a separate `update` would let two requests presenting the same
  // token both observe `revokedAt: null` and both mint a session — this
  // collapses that check-then-act gap into one atomic step.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (count === 0) {
    // This request lost the race to a concurrent refresh of the same token,
    // or the token had already been rotated before we read it — either way,
    // reuse of a token that is not the current one. Revoke every other active
    // token for the user, not just this one (Section 6).
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthenticatedError('This session has been revoked. Sign in again.');
  }

  const session = await issueSession(stored.user);
  return { user: toUserResponse(stored.user), ...session };
};

/**
 * Revokes the presented refresh token if it belongs to the caller. A missing,
 * unknown, or already-revoked token is not an error — signing out always
 * succeeds from the caller's point of view.
 * @param {{ userId: string, refreshToken: string | null }} args
 * @returns {Promise<void>}
 */
export const logout = async ({ userId, refreshToken }) => {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/**
 * Loads a user by id, rejecting a session whose account no longer exists or
 * has since been deactivated. `authenticate` only checks the token's
 * signature (Section 6), so this is where deactivation actually takes effect
 * for `/auth/me`.
 * @param {string} userId
 * @returns {Promise<object>} the raw Prisma row
 * @throws {UnauthenticatedError}
 */
const loadActiveUser = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthenticatedError('Your session is not valid. Sign in again.');
  }
  return user;
};

/**
 * The caller's own profile.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const getMe = async (userId) => toUserResponse(await loadActiveUser(userId));

/**
 * Updates the caller's own name and/or phone. Role and activation are
 * admin-only (`PATCH /users/:id`).
 * @param {string} userId
 * @param {{ fullName?: string, phone?: string | null }} patch
 * @returns {Promise<object>}
 */
export const updateMe = async (userId, patch) => {
  await loadActiveUser(userId);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    },
  });
  return toUserResponse(user);
};
