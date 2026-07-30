import { prisma } from '../../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { fromIsoDate } from '../../utils/serialize.js';
import {
  assertPropertyExists,
  OWNER_USER_INCLUDE,
  PROPERTY_COVER_INCLUDE,
  PROPERTY_DETAIL_INCLUDE,
  serializeOwnership,
  serializePropertyDetail,
  serializePropertySummary,
} from './ownership.helpers.js';

/**
 * Business logic for ownerships (Section 4.2/5.2): the share-percentage cap,
 * agency-facing CRUD, and the owner-facing `/me/properties` views.
 */

/** Matches the `share_percentage` column default (Section 4.2) — a row with no share supplied means sole ownership. */
const DEFAULT_SHARE_PERCENTAGE = '100.00';

/** Total `share_percentage` across a property must never exceed this (Section 4.2/11.1). */
const SHARE_CAP = 100;

/**
 * Sums `share_percentage` across every ownership row for a property —
 * excluding one row (the one being updated, if any) — and checks that adding
 * `nextShare` would not push the total over 100%. A per-row check constraint
 * already enforces `(0, 100]` at the database level; this cross-row sum is
 * the one thing only application code can see (Section 4.2).
 * @param {{ propertyId: string, nextShare: string, excludeId?: string }} args
 * @returns {Promise<void>}
 * @throws {ConflictError} when the cap would be exceeded
 */
const assertShareCapNotExceeded = async ({ propertyId, nextShare, excludeId }) => {
  const aggregate = await prisma.ownership.aggregate({
    where: { propertyId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { sharePercentage: true },
  });
  const existingTotal = Number(aggregate._sum.sharePercentage ?? 0);
  const total = existingTotal + Number(nextShare);

  if (total > SHARE_CAP) {
    throw new ConflictError(
      `Total ownership share for this property cannot exceed 100% (already ${existingTotal.toFixed(2)}%, this would add ${Number(nextShare).toFixed(2)}%).`,
    );
  }
};

/**
 * `GET /me/properties` — the caller's own holdings, most recently registered
 * first. Always scoped by the authenticated user's id, never a
 * client-supplied one (Section 5.3).
 * @param {{ userId: string, page: number, limit: number }} args
 * @returns {Promise<{ rows: object[], meta: object }>} `OwnedPropertyListItemSchema[]` rows plus pagination meta
 */
export const listMyProperties = async ({ userId, page, limit }) => {
  const where = { ownerUserId: userId };

  const [rows, total] = await Promise.all([
    prisma.ownership.findMany({
      where,
      include: { property: { include: PROPERTY_COVER_INCLUDE }, ...OWNER_USER_INCLUDE },
      orderBy: { createdAt: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.ownership.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      property: serializePropertySummary(row.property),
      ownership: serializeOwnership(row),
    })),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `GET /me/properties/:id` — full property detail plus the caller's own
 * ownership row and every share on the plot, so a co-owner can see how the
 * 100% splits (Section 5.2). A caller who does not appear in `ownerships`
 * for this property gets a 403, never a 404 (Section 5.3).
 * @param {{ propertyId: string, userId: string }} args
 * @returns {Promise<object>} `OwnedPropertyDetailSchema` shape
 * @throws {NotFoundError} when no such property exists
 * @throws {ForbiddenError} when the caller does not own a share of it
 */
export const getMyPropertyDetail = async ({ propertyId, userId }) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: PROPERTY_DETAIL_INCLUDE,
  });
  if (!property) throw new NotFoundError('We could not find that property.');

  const ownerships = await prisma.ownership.findMany({
    where: { propertyId },
    include: OWNER_USER_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  const mine = ownerships.find((ownership) => ownership.ownerUserId === userId);
  if (!mine) throw new ForbiddenError('You do not have access to this property.');

  return {
    property: serializePropertyDetail(property),
    ownership: serializeOwnership(mine),
    ownerships: ownerships.map(serializeOwnership),
  };
};

/**
 * `POST /properties/:id/ownerships` — agent-recorded ownership share.
 * `@@unique([propertyId, ownerUserId])` means the same person can never be
 * recorded twice on one property; checked explicitly here (rather than
 * relying only on the database's P2002 mapping) so the failure carries a
 * message specific to this rule, with the unique index as the backstop
 * against a race between two concurrent requests.
 * @param {{ propertyId: string, ownerUserId: string, sharePercentage?: string, registeredOn?: string|null, documentRef?: string|null, notes?: string|null }} args
 * @returns {Promise<object>} `OwnershipResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 * @throws {ConflictError} when this person already owns a share, or the 100% cap would be exceeded
 */
export const createOwnership = async ({
  propertyId,
  ownerUserId,
  sharePercentage,
  registeredOn,
  documentRef,
  notes,
}) => {
  await assertPropertyExists(propertyId);

  const existing = await prisma.ownership.findUnique({
    where: { propertyId_ownerUserId: { propertyId, ownerUserId } },
  });
  if (existing) {
    throw new ConflictError('This person is already recorded as an owner of this property.');
  }

  const nextShare = sharePercentage ?? DEFAULT_SHARE_PERCENTAGE;
  await assertShareCapNotExceeded({ propertyId, nextShare });

  const created = await prisma.ownership.create({
    data: {
      propertyId,
      ownerUserId,
      sharePercentage: nextShare,
      registeredOn: registeredOn ? fromIsoDate(registeredOn) : null,
      documentRef: documentRef ?? null,
      notes: notes ?? null,
    },
    include: OWNER_USER_INCLUDE,
  });

  return serializeOwnership(created);
};

/**
 * `PATCH /ownerships/:id` — agent update. Re-checks the share cap against
 * every *other* row on the same property whenever `sharePercentage` is part
 * of the patch, and re-checks the one-owner-per-property uniqueness whenever
 * `ownerUserId` changes.
 * @param {{ id: string, ownerUserId?: string, sharePercentage?: string, registeredOn?: string|null, documentRef?: string|null, notes?: string|null }} args
 * @returns {Promise<object>} `OwnershipResponseSchema` shape
 * @throws {NotFoundError} when no such ownership record exists
 * @throws {ConflictError} when the new owner already has a record on this property, or the 100% cap would be exceeded
 */
export const updateOwnership = async ({
  id,
  ownerUserId,
  sharePercentage,
  registeredOn,
  documentRef,
  notes,
}) => {
  const existing = await prisma.ownership.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('We could not find that ownership record.');

  if (ownerUserId !== undefined && ownerUserId !== existing.ownerUserId) {
    const clash = await prisma.ownership.findUnique({
      where: { propertyId_ownerUserId: { propertyId: existing.propertyId, ownerUserId } },
    });
    if (clash) {
      throw new ConflictError('This person is already recorded as an owner of this property.');
    }
  }

  if (sharePercentage !== undefined) {
    await assertShareCapNotExceeded({
      propertyId: existing.propertyId,
      nextShare: sharePercentage,
      excludeId: id,
    });
  }

  const data = {
    ...(ownerUserId !== undefined ? { ownerUserId } : {}),
    ...(sharePercentage !== undefined ? { sharePercentage } : {}),
    ...(registeredOn !== undefined ? { registeredOn: fromIsoDate(registeredOn) } : {}),
    ...(documentRef !== undefined ? { documentRef } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };

  const updated = await prisma.ownership.update({ where: { id }, data, include: OWNER_USER_INCLUDE });
  return serializeOwnership(updated);
};

/**
 * `DELETE /ownerships/:id` — admin only (Section 5.2/5.3).
 * @param {{ id: string }} args
 * @returns {Promise<void>}
 * @throws {NotFoundError} when no such ownership record exists
 */
export const deleteOwnership = async ({ id }) => {
  const existing = await prisma.ownership.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('We could not find that ownership record.');

  await prisma.ownership.delete({ where: { id } });
};
