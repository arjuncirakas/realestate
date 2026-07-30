import { prisma } from '../../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { toDecimalString, toIsoDateTime } from '../../utils/serialize.js';
import {
  COVER_MEDIA_INCLUDE,
  serializePropertySummary,
} from '../enquiries/property-summary.helpers.js';

/**
 * Group-purchase interest registrations (Section 4.2). This is an
 * expression-of-interest register only — it records that a person wants the
 * agency to follow up, never a commitment and never money moving
 * (Section 1.3). Copy in this file uses "register interest" language only.
 */

/** Statuses that count as an open registration and block a second one. */
const OPEN_INTEREST_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED'];

/**
 * Projects an interest registration row into `InterestResponseSchema` — the
 * agent-facing shape, including `agentNotes`.
 * @param {object} interest Prisma interest registration row
 * @returns {object}
 */
const serializeInterest = (interest) => ({
  id: interest.id,
  propertyId: interest.propertyId,
  userId: interest.userId,
  indicativeAmount: toDecimalString(interest.indicativeAmount),
  notes: interest.notes,
  status: interest.status,
  agentNotes: interest.agentNotes,
  createdAt: toIsoDateTime(interest.createdAt),
  updatedAt: toIsoDateTime(interest.updatedAt),
});

/**
 * Projects an interest registration row into `InterestWithPropertySchema` for
 * `GET /interests`.
 * @param {object} interest Prisma interest registration row, with `property` (+cover media) loaded
 * @returns {object}
 */
const serializeInterestWithProperty = (interest) => ({
  ...serializeInterest(interest),
  property: serializePropertySummary(interest.property),
});

/**
 * Projects an interest registration row into `MyInterestWithPropertySchema`
 * for `GET /me/interests` — the registrant's own view. `agentNotes` is the
 * agency's internal follow-up record and is omitted; the registrant still
 * sees their own `indicativeAmount`, `notes` and `status`.
 * @param {object} interest Prisma interest registration row, with `property` (+cover media) loaded
 * @returns {object}
 */
const serializeMyInterestWithProperty = (interest) => ({
  id: interest.id,
  propertyId: interest.propertyId,
  userId: interest.userId,
  indicativeAmount: toDecimalString(interest.indicativeAmount),
  notes: interest.notes,
  status: interest.status,
  createdAt: toIsoDateTime(interest.createdAt),
  updatedAt: toIsoDateTime(interest.updatedAt),
  property: serializePropertySummary(interest.property),
});

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
 * `POST /properties/:id/interest` — registers an expression of interest. One
 * *open* registration per person per property (Section 4.2/5.2) — a second
 * attempt while the existing one is `NEW`/`CONTACTED`/`QUALIFIED` is a 409.
 *
 * The unique index on `(property_id, user_id)` is not status-aware, so once a
 * person has withdrawn (or an agent has closed) their registration, there is
 * exactly one row for that pair and it can never be inserted again — it can
 * only be reused. Registering again after `WITHDRAWN`/`CLOSED` therefore
 * reopens that same row as `NEW` with the newly supplied amount and notes,
 * rather than permanently locking the person out of a plot they are once
 * again interested in.
 * @param {{ propertyId: string, userId: string, indicativeAmount?: string|null, notes?: string|null }} args
 * @returns {Promise<object>} `InterestResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 * @throws {ConflictError} when this person already has an open registration on the property
 */
export const registerInterest = async ({ propertyId, userId, indicativeAmount, notes }) => {
  await assertPropertyExists(propertyId);

  const existing = await prisma.interestRegistration.findUnique({
    where: { propertyId_userId: { propertyId, userId } },
  });

  if (existing && OPEN_INTEREST_STATUSES.includes(existing.status)) {
    throw new ConflictError('You have already registered interest in this property.');
  }

  const interest = existing
    ? await prisma.interestRegistration.update({
        where: { id: existing.id },
        data: {
          status: 'NEW',
          indicativeAmount: indicativeAmount ?? null,
          notes: notes ?? null,
        },
      })
    : await prisma.interestRegistration.create({
        data: {
          propertyId,
          userId,
          indicativeAmount: indicativeAmount ?? null,
          notes: notes ?? null,
        },
      });

  return serializeInterest(interest);
};

/**
 * @param {{ userId?: string, status?: string, propertyId?: string }} filters
 * @returns {object} a Prisma `where` clause
 */
const buildWhere = ({ userId, status, propertyId }) => ({
  ...(userId ? { userId } : {}),
  ...(status ? { status } : {}),
  ...(propertyId ? { propertyId } : {}),
});

/**
 * @param {{ where: object, page: number, limit: number, serializeRow: (row: object) => object }} args
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
const findInterests = async ({ where, page, limit, serializeRow }) => {
  const [rows, total] = await Promise.all([
    prisma.interestRegistration.findMany({
      where,
      include: { property: { include: COVER_MEDIA_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.interestRegistration.count({ where }),
  ]);

  return {
    rows: rows.map(serializeRow),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `GET /me/interests` — the caller's own registrations. Always scoped by the
 * authenticated user's id, never a client-supplied one (Section 5.3). Returns
 * the narrower `MyInterestWithPropertySchema` row — no `agentNotes`.
 * @param {{ userId: string, page: number, limit: number, status?: string, propertyId?: string }} query
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export const listMyInterests = ({ userId, page, limit, status, propertyId }) =>
  findInterests({
    where: buildWhere({ userId, status, propertyId }),
    page,
    limit,
    serializeRow: serializeMyInterestWithProperty,
  });

/**
 * `GET /interests` — agent follow-up queue.
 * @param {{ page: number, limit: number, status?: string, propertyId?: string }} query
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export const listInterestsForAgent = ({ page, limit, status, propertyId }) =>
  findInterests({
    where: buildWhere({ status, propertyId }),
    page,
    limit,
    serializeRow: serializeInterestWithProperty,
  });

/**
 * `PATCH /me/interests/:id/withdraw` — own-record-only (Section 5.3): a
 * registration that belongs to someone else 403s rather than 404-leaking
 * whether it exists.
 * @param {{ id: string, userId: string }} args
 * @returns {Promise<object>} `InterestResponseSchema` shape
 * @throws {NotFoundError} when no such registration exists
 * @throws {ForbiddenError} when the registration belongs to a different user
 * @throws {ConflictError} when the registration is already withdrawn
 */
export const withdrawMyInterest = async ({ id, userId }) => {
  const interest = await prisma.interestRegistration.findUnique({ where: { id } });
  if (!interest) throw new NotFoundError('We could not find that interest registration.');
  if (interest.userId !== userId) {
    throw new ForbiddenError('You do not have access to this interest registration.');
  }
  if (interest.status === 'WITHDRAWN') {
    throw new ConflictError('This interest registration has already been withdrawn.');
  }

  const updated = await prisma.interestRegistration.update({
    where: { id },
    data: { status: 'WITHDRAWN' },
  });
  return serializeInterest(updated);
};

/**
 * `PATCH /interests/:id` — agent follow-up: status, notes.
 * @param {{ id: string, status?: string, agentNotes?: string|null }} args
 * @returns {Promise<object>} `InterestResponseSchema` shape
 * @throws {NotFoundError} when no such registration exists
 */
export const updateInterestForAgent = async ({ id, status, agentNotes }) => {
  const existing = await prisma.interestRegistration.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('We could not find that interest registration.');

  const updated = await prisma.interestRegistration.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(agentNotes !== undefined ? { agentNotes } : {}),
    },
  });
  return serializeInterest(updated);
};
