import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../config/prisma.js';
import { ConflictError, UnauthenticatedError } from '../../utils/app-error.js';
import * as authService from './auth.service.js';
import { hashRefreshToken } from './auth.helpers.js';

/**
 * Business-rule tests for the auth service, run directly against the shared
 * dev database (Section 11.1) rather than through HTTP — refresh rotation and
 * family revocation is the rule most worth pinning down here.
 */

const createdUserIds = [];

/** A unique test fixture email, so this suite never collides with a teammate's. */
const makeEmail = (label) => `wp1-${label}-${randomUUID()}@example.test`;

afterAll(async () => {
  if (createdUserIds.length === 0) return;
  // Cascades to refresh_tokens (Section 4.2: onDelete Cascade).
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

/** Registers a fixture subscriber and tracks it for cleanup. */
const registerFixture = async (label, overrides = {}) => {
  const result = await authService.register({
    email: makeEmail(label),
    password: 'Password123',
    fullName: 'Fixture Subscriber',
    ...overrides,
  });
  createdUserIds.push(result.user.id);
  return result;
};

describe('register', () => {
  it('creates a SUBSCRIBER account and starts a session', async () => {
    const result = await registerFixture('register-happy');

    expect(result.user.role).toBe('SUBSCRIBER');
    expect(result.user.isActive).toBe(true);
    expect(typeof result.accessToken).toBe('string');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{128}$/);
    expect(result.accessTokenExpiresIn).toBeGreaterThan(0);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(result.refreshToken) },
    });
    expect(stored?.userId).toBe(result.user.id);
    expect(stored?.revokedAt).toBeNull();
  });

  it('rejects a duplicate email with a conflict', async () => {
    const email = makeEmail('register-dupe');
    const first = await authService.register({
      email,
      password: 'Password123',
      fullName: 'First Owner',
    });
    createdUserIds.push(first.user.id);

    await expect(
      authService.register({ email, password: 'Password123', fullName: 'Second Claimant' }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('login', () => {
  it('rejects a wrong password without revealing which field was wrong', async () => {
    const { user } = await registerFixture('login-wrongpass');
    const account = await prisma.user.findUnique({ where: { id: user.id } });

    await expect(
      authService.login({ email: account.email, password: 'WrongPassword123' }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('gives an unknown email and a wrong password the same message', async () => {
    const { user } = await registerFixture('login-oracle');
    const account = await prisma.user.findUnique({ where: { id: user.id } });

    const unknownEmailError = await authService
      .login({ email: makeEmail('login-oracle-nobody'), password: 'WrongPassword123' })
      .catch((error) => error);
    const wrongPasswordError = await authService
      .login({ email: account.email, password: 'WrongPassword123' })
      .catch((error) => error);

    expect(unknownEmailError).toBeInstanceOf(UnauthenticatedError);
    expect(wrongPasswordError).toBeInstanceOf(UnauthenticatedError);
    expect(unknownEmailError.message).toBe(wrongPasswordError.message);
  });

  it('rejects a deactivated account even with the correct password', async () => {
    const { user } = await registerFixture('login-deactivated');
    const account = await prisma.user.findUnique({ where: { id: user.id } });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    await expect(
      authService.login({ email: account.email, password: 'Password123' }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('starts a new session on success', async () => {
    const { user } = await registerFixture('login-happy');
    const account = await prisma.user.findUnique({ where: { id: user.id } });

    const result = await authService.login({ email: account.email, password: 'Password123' });
    expect(result.user.id).toBe(user.id);
    expect(typeof result.accessToken).toBe('string');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{128}$/);
  });
});

describe('refresh', () => {
  it('rotates the token: the old one is revoked and the new one is different', async () => {
    const { refreshToken: original } = await registerFixture('refresh-rotate');

    const rotated = await authService.refresh(original);
    expect(rotated.refreshToken).not.toBe(original);

    const oldRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(original) },
    });
    expect(oldRow?.revokedAt).not.toBeNull();

    const newRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rotated.refreshToken) },
    });
    expect(newRow?.revokedAt).toBeNull();
  });

  it('reuse of a revoked token revokes every other active token for that user', async () => {
    const { refreshToken: tokenA } = await registerFixture('refresh-family');

    // Normal rotation: A -> B.
    const { refreshToken: tokenB } = await authService.refresh(tokenA);

    // A is now revoked. Presenting it again is reuse of a revoked token, so
    // the whole family for the user — including B, which was never itself
    // reused — must be revoked as a result.
    await expect(authService.refresh(tokenA)).rejects.toThrow(UnauthenticatedError);

    const rowB = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(tokenB) } });
    expect(rowB?.revokedAt).not.toBeNull();

    await expect(authService.refresh(tokenB)).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects an unknown token', async () => {
    await expect(authService.refresh('a'.repeat(128))).rejects.toThrow(UnauthenticatedError);
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    // Regression test for the check-then-act gap: a plain findUnique + update
    // would let both requests observe `revokedAt: null` before either write
    // lands. The fix makes the revoke a conditional write, so the database
    // itself arbitrates which request wins the race.
    const { refreshToken } = await registerFixture('refresh-concurrent');

    const results = await Promise.allSettled([
      authService.refresh(refreshToken),
      authService.refresh(refreshToken),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UnauthenticatedError);
  });

  it('rejects and revokes a token belonging to a deactivated user', async () => {
    const { user, refreshToken } = await registerFixture('refresh-deactivated');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthenticatedError);

    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(refreshToken) } });
    expect(row?.revokedAt).not.toBeNull();
  });
});

describe('logout', () => {
  it('revokes the presented token, after which it can no longer refresh', async () => {
    const { user, refreshToken } = await registerFixture('logout-happy');

    await authService.logout({ userId: user.id, refreshToken });

    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(refreshToken) } });
    expect(row?.revokedAt).not.toBeNull();
    await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthenticatedError);
  });

  it('is a no-op when there is no token to revoke', async () => {
    const { user } = await registerFixture('logout-notoken');
    await expect(authService.logout({ userId: user.id, refreshToken: null })).resolves.toBeUndefined();
  });

  it('does not revoke a token belonging to a different user', async () => {
    const owner = await registerFixture('logout-owner');
    const bystander = await registerFixture('logout-bystander');

    await authService.logout({ userId: bystander.user.id, refreshToken: owner.refreshToken });

    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(owner.refreshToken) },
    });
    expect(row?.revokedAt).toBeNull();
  });
});

describe('getMe / updateMe', () => {
  it('rejects a deactivated account', async () => {
    const { user } = await registerFixture('me-deactivated');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    await expect(authService.getMe(user.id)).rejects.toThrow(UnauthenticatedError);
  });

  it('updates the caller\'s own name and phone', async () => {
    const { user } = await registerFixture('me-update');

    const updated = await authService.updateMe(user.id, { fullName: 'Updated Name', phone: '+91 98765 43210' });
    expect(updated.fullName).toBe('Updated Name');
    expect(updated.phone).toBe('+91 98765 43210');
  });
});
