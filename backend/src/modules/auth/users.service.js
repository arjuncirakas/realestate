import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { toUserResponse } from './auth.helpers.js';

/**
 * Admin user management (Section 5.2: `GET /users`, `PATCH /users/:id`). This
 * is the "Admin users" table the lead assigned to WP1, since no other work
 * package touches the `users` table.
 */

/**
 * Paginated, filterable user directory.
 * @param {{ page: number, limit: number, q?: string, role?: string, isActive?: boolean }} query
 * @returns {Promise<{ items: object[], meta: { page: number, limit: number, total: number, totalPages: number } }>}
 */
export const listUsers = async ({ page, limit, q, role, isActive }) => {
  const where = {
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(q
      ? {
          OR: [
            // email is citext, which is case-insensitive at the column level
            // already; `fullName` is a plain varchar and needs mode explicitly.
            { email: { contains: q } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...toPrismaPagination({ page, limit }) }),
    prisma.user.count({ where }),
  ]);

  return { items: rows.map(toUserResponse), meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Updates a user's role and/or activation flag.
 *
 * Deactivating a user, or changing their role, also revokes every refresh
 * token they currently hold, so the change takes effect as soon as their
 * current access token expires — at most 15 minutes (Section 6) — rather than
 * up to the full 30-day refresh window. Without this, an agent demoted to
 * subscriber would keep agent-level authority for as long as they kept
 * refreshing.
 *
 * @param {string} id
 * @param {{ role?: string, isActive?: boolean }} patch
 * @returns {Promise<object>}
 * @throws {NotFoundError} when no user has that id
 */
export const updateUser = async (id, patch) => {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('No such user.');
  }

  const user = await prisma.user.update({ where: { id }, data: patch });

  const roleChanged = patch.role !== undefined && patch.role !== existing.role;
  if (patch.isActive === false || roleChanged) {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return toUserResponse(user);
};
