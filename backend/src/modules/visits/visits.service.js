import { prisma } from '../../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { fromIsoDate, toIsoDate, toIsoDateTime } from '../../utils/serialize.js';
import {
  COVER_MEDIA_INCLUDE,
  serializePropertySummary,
} from '../enquiries/property-summary.helpers.js';

/**
 * Site visit requests (Section 4.2): a subscriber books a preferred date and
 * slot, an agent confirms or completes it.
 */

/**
 * Projects a site visit row into `SiteVisitResponseSchema` — the agent-facing
 * shape, including `agentNotes`.
 * @param {object} visit Prisma site visit row
 * @returns {object}
 */
const serializeSiteVisit = (visit) => ({
  id: visit.id,
  propertyId: visit.propertyId,
  userId: visit.userId,
  preferredDate: toIsoDate(visit.preferredDate),
  preferredSlot: visit.preferredSlot,
  contactPhone: visit.contactPhone,
  status: visit.status,
  confirmedAt: toIsoDateTime(visit.confirmedAt),
  agentNotes: visit.agentNotes,
  createdAt: toIsoDateTime(visit.createdAt),
  updatedAt: toIsoDateTime(visit.updatedAt),
});

/**
 * Projects a site visit row into `SiteVisitWithPropertySchema` for
 * `GET /site-visits`.
 * @param {object} visit Prisma site visit row, with `property` (+cover media) loaded
 * @returns {object}
 */
const serializeSiteVisitWithProperty = (visit) => ({
  ...serializeSiteVisit(visit),
  property: serializePropertySummary(visit.property),
});

/**
 * Projects a site visit row into `MySiteVisitWithPropertySchema` for
 * `GET /me/site-visits` — the requester's own view. `confirmedAt` stays (the
 * visitor needs to know their slot was confirmed); `agentNotes` is omitted —
 * it is the agency's internal record about the visit, not something
 * Section 5.3's "own records" grants access to.
 * @param {object} visit Prisma site visit row, with `property` (+cover media) loaded
 * @returns {object}
 */
const serializeMySiteVisitWithProperty = (visit) => ({
  id: visit.id,
  propertyId: visit.propertyId,
  userId: visit.userId,
  preferredDate: toIsoDate(visit.preferredDate),
  preferredSlot: visit.preferredSlot,
  contactPhone: visit.contactPhone,
  status: visit.status,
  confirmedAt: toIsoDateTime(visit.confirmedAt),
  createdAt: toIsoDateTime(visit.createdAt),
  updatedAt: toIsoDateTime(visit.updatedAt),
  property: serializePropertySummary(visit.property),
});

/**
 * Rejects a preferred date earlier than today. Deliberately a service-level
 * rule rather than a contract rule: the contract validates the `YYYY-MM-DD`
 * format only, because "today" depends on the server's clock and a zod schema
 * cannot express that comparison.
 * @param {string} preferredDate `YYYY-MM-DD`
 * @returns {void}
 * @throws {ValidationError} when the date is before today (UTC)
 */
export const assertPreferredDateNotInThePast = (preferredDate) => {
  const requested = fromIsoDate(preferredDate);
  const today = fromIsoDate(new Date().toISOString().slice(0, 10));
  if (requested < today) {
    throw new ValidationError('The preferred visit date must not be in the past.', [
      { field: 'preferredDate', message: 'Choose today or a later date.' },
    ]);
  }
};

/**
 * @param {string} propertyId
 * @returns {Promise<void>}
 * @throws {NotFoundError} when no such property exists
 */
const assertPropertyExists = async (propertyId) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) throw new NotFoundError('We could not find that property.');
};

/**
 * Books a site visit request. Starts life as `REQUESTED` (Section 4.2).
 * @param {{ propertyId: string, userId: string, preferredDate: string, preferredSlot: string, contactPhone?: string }} args
 * @returns {Promise<object>} `SiteVisitResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 * @throws {ValidationError} when the preferred date is in the past
 */
export const createSiteVisit = async ({
  propertyId,
  userId,
  preferredDate,
  preferredSlot,
  contactPhone,
}) => {
  assertPreferredDateNotInThePast(preferredDate);
  await assertPropertyExists(propertyId);

  const visit = await prisma.siteVisit.create({
    data: {
      propertyId,
      userId,
      preferredDate: fromIsoDate(preferredDate),
      preferredSlot,
      contactPhone: contactPhone ?? null,
    },
  });

  return serializeSiteVisit(visit);
};

/**
 * @param {{ userId?: string, status?: string, propertyId?: string, from?: string, to?: string }} filters
 * @returns {object} a Prisma `where` clause
 */
const buildWhere = ({ userId, status, propertyId, from, to }) => ({
  ...(userId ? { userId } : {}),
  ...(status ? { status } : {}),
  ...(propertyId ? { propertyId } : {}),
  ...(from || to
    ? {
        preferredDate: {
          ...(from ? { gte: fromIsoDate(from) } : {}),
          ...(to ? { lte: fromIsoDate(to) } : {}),
        },
      }
    : {}),
});

/**
 * @param {{ where: object, page: number, limit: number, serializeRow: (row: object) => object }} args
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
const findSiteVisits = async ({ where, page, limit, serializeRow }) => {
  const [rows, total] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      include: { property: { include: COVER_MEDIA_INCLUDE } },
      orderBy: { preferredDate: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.siteVisit.count({ where }),
  ]);

  return {
    rows: rows.map(serializeRow),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `GET /me/site-visits` — the caller's own requests. Always scoped by the
 * authenticated user's id, never a client-supplied one (Section 5.3). Returns
 * the narrower `MySiteVisitWithPropertySchema` row — no `agentNotes`.
 * @param {{ userId: string, page: number, limit: number, status?: string, propertyId?: string, from?: string, to?: string }} query
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export const listMySiteVisits = ({ userId, page, limit, status, propertyId, from, to }) =>
  findSiteVisits({
    where: buildWhere({ userId, status, propertyId, from, to }),
    page,
    limit,
    serializeRow: serializeMySiteVisitWithProperty,
  });

/**
 * `GET /site-visits` — agent queue.
 * @param {{ page: number, limit: number, status?: string, propertyId?: string, from?: string, to?: string }} query
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export const listSiteVisitsForAgent = ({ page, limit, status, propertyId, from, to }) =>
  findSiteVisits({
    where: buildWhere({ status, propertyId, from, to }),
    page,
    limit,
    serializeRow: serializeSiteVisitWithProperty,
  });

/**
 * `PATCH /me/site-visits/:id/cancel` — own-record-only (Section 5.3): a
 * request that belongs to someone else 403s rather than 404-leaking whether
 * it exists.
 * @param {{ id: string, userId: string }} args
 * @returns {Promise<object>} `SiteVisitResponseSchema` shape
 * @throws {NotFoundError} when no such visit exists
 * @throws {ForbiddenError} when the visit belongs to a different user
 * @throws {ConflictError} when the visit is already completed or cancelled
 */
export const cancelMySiteVisit = async ({ id, userId }) => {
  const visit = await prisma.siteVisit.findUnique({ where: { id } });
  if (!visit) throw new NotFoundError('We could not find that site visit.');
  if (visit.userId !== userId) {
    throw new ForbiddenError('You do not have access to this site visit.');
  }
  if (visit.status === 'CANCELLED' || visit.status === 'COMPLETED') {
    throw new ConflictError('This site visit can no longer be cancelled.');
  }

  const updated = await prisma.siteVisit.update({ where: { id }, data: { status: 'CANCELLED' } });
  return serializeSiteVisit(updated);
};

/**
 * `PATCH /site-visits/:id` — agent confirms, completes or annotates a visit.
 * Confirming stamps `confirmedAt` the first time only.
 * @param {{ id: string, status?: string, preferredDate?: string, preferredSlot?: string, agentNotes?: string|null }} args
 * @returns {Promise<object>} `SiteVisitResponseSchema` shape
 * @throws {NotFoundError} when no such visit exists
 * @throws {ValidationError} when a rescheduled date is in the past
 */
export const updateSiteVisitForAgent = async ({
  id,
  status,
  preferredDate,
  preferredSlot,
  agentNotes,
}) => {
  const existing = await prisma.siteVisit.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('We could not find that site visit.');

  if (preferredDate !== undefined) assertPreferredDateNotInThePast(preferredDate);

  const data = {
    ...(status !== undefined ? { status } : {}),
    ...(preferredDate !== undefined ? { preferredDate: fromIsoDate(preferredDate) } : {}),
    ...(preferredSlot !== undefined ? { preferredSlot } : {}),
    ...(agentNotes !== undefined ? { agentNotes } : {}),
  };
  if (status === 'CONFIRMED' && !existing.confirmedAt) {
    data.confirmedAt = new Date();
  }

  const updated = await prisma.siteVisit.update({ where: { id }, data });
  return serializeSiteVisit(updated);
};
