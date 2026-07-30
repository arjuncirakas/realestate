import { prisma } from '../../config/prisma.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { toIsoDateTime } from '../../utils/serialize.js';
import {
  assertPropertyExists,
  COVER_MEDIA_INCLUDE,
  serializePropertySummary,
} from '../enquiries/property-summary.helpers.js';

/**
 * Saved plots (Section 4.2): a subscriber's shortlist, keyed by the composite
 * primary key `(user_id, property_id)`.
 */

/**
 * Projects a saved-property row into `SavedPropertyResponseSchema`.
 * @param {object} saved Prisma saved property row
 * @returns {object}
 */
const serializeSaved = (saved) => ({
  userId: saved.userId,
  propertyId: saved.propertyId,
  createdAt: toIsoDateTime(saved.createdAt),
});

/**
 * Projects a saved-property row into `SavedPropertyWithPropertySchema`.
 * @param {object} saved Prisma saved property row, with `property` (+cover media) loaded
 * @returns {object}
 */
const serializeSavedWithProperty = (saved) => ({
  ...serializeSaved(saved),
  property: serializePropertySummary(saved.property),
});

/**
 * `GET /me/saved` — the caller's shortlist, most recently saved first,
 * paginated like every other list endpoint (Section 5.1/5.2). Always scoped
 * by the authenticated user's id, never a client-supplied one (Section 5.3).
 * @param {{ userId: string, page: number, limit: number }} args
 * @returns {Promise<{ rows: object[], meta: object }>} `SavedPropertyWithPropertySchema[]` rows plus pagination meta
 */
export const listMySaved = async ({ userId, page, limit }) => {
  const where = { userId };

  const [rows, total] = await Promise.all([
    prisma.savedProperty.findMany({
      where,
      include: { property: { include: COVER_MEDIA_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.savedProperty.count({ where }),
  ]);

  return {
    rows: rows.map(serializeSavedWithProperty),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `POST /me/saved/:propertyId` — saves a plot. Idempotent: saving an
 * already-saved plot succeeds rather than conflicting, backed by an `upsert`
 * against the composite primary key (Section 5.2).
 * @param {{ userId: string, propertyId: string }} args
 * @returns {Promise<object>} `SavedPropertyResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 */
export const saveProperty = async ({ userId, propertyId }) => {
  await assertPropertyExists(propertyId);

  const saved = await prisma.savedProperty.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
  });

  return serializeSaved(saved);
};

/**
 * `DELETE /me/saved/:propertyId` — removes a plot from the shortlist. Scoped
 * by the composite key, so this can never touch another user's row; if the
 * plot was never saved by this user, Prisma's `P2025` is mapped centrally to
 * `NOT_FOUND` (Section 5.1).
 * @param {{ userId: string, propertyId: string }} args
 * @returns {Promise<object>} `SavedPropertyResponseSchema` shape of the removed row
 */
export const unsaveProperty = async ({ userId, propertyId }) => {
  const saved = await prisma.savedProperty.delete({
    where: { userId_propertyId: { userId, propertyId } },
  });
  return serializeSaved(saved);
};
