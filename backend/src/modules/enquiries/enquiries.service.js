import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { toIsoDateTime } from '../../utils/serialize.js';
import { COVER_MEDIA_INCLUDE, serializePropertySummary } from './property-summary.helpers.js';

/**
 * Enquiries — public, rate-limited leads on a listing (Section 4.2). Guests
 * may raise one; a signed-in visitor's is attributed to their account, but the
 * visible contact fields are always whatever the form submitted.
 */

/**
 * @param {object|null} user Prisma user row, or null
 * @returns {{ id: string, fullName: string }|null}
 */
const toUserSummary = (user) => (user ? { id: user.id, fullName: user.fullName } : null);

/**
 * Projects an enquiry row into `EnquiryResponseSchema` — the agent-facing
 * shape, including `assignedAgent` and `agentNotes`.
 * @param {object} enquiry Prisma enquiry row, with `assignedAgent` loaded
 * @returns {object}
 */
const serializeEnquiry = (enquiry) => ({
  id: enquiry.id,
  propertyId: enquiry.propertyId,
  userId: enquiry.userId,
  name: enquiry.name,
  email: enquiry.email,
  phone: enquiry.phone,
  message: enquiry.message,
  status: enquiry.status,
  assignedAgentId: enquiry.assignedAgentId,
  assignedAgent: toUserSummary(enquiry.assignedAgent),
  agentNotes: enquiry.agentNotes,
  createdAt: toIsoDateTime(enquiry.createdAt),
  updatedAt: toIsoDateTime(enquiry.updatedAt),
});

/**
 * Projects an enquiry row into `EnquiryWithPropertySchema` for `GET /enquiries`.
 * @param {object} enquiry Prisma enquiry row, with `assignedAgent` and `property` (+cover media) loaded
 * @returns {object}
 */
const serializeEnquiryWithProperty = (enquiry) => ({
  ...serializeEnquiry(enquiry),
  property: serializePropertySummary(enquiry.property),
});

/**
 * Projects an enquiry row into `MyEnquiryWithPropertySchema` for
 * `GET /me/enquiries` — the enquirer's own view. Omits `assignedAgentId`,
 * `assignedAgent` and `agentNotes`: those are the agency's internal triage
 * record about this person, not something Section 5.3's "own records" grants
 * access to.
 * @param {object} enquiry Prisma enquiry row, with `property` (+cover media) loaded
 * @returns {object}
 */
const serializeMyEnquiryWithProperty = (enquiry) => ({
  id: enquiry.id,
  propertyId: enquiry.propertyId,
  userId: enquiry.userId,
  name: enquiry.name,
  email: enquiry.email,
  phone: enquiry.phone,
  message: enquiry.message,
  status: enquiry.status,
  createdAt: toIsoDateTime(enquiry.createdAt),
  updatedAt: toIsoDateTime(enquiry.updatedAt),
  property: serializePropertySummary(enquiry.property),
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
 * Raises an enquiry on a listing. `userId` is null for a guest (Section 4.2).
 * @param {{ propertyId: string, userId: string|null, name: string, email: string, phone?: string, message: string }} args
 * @returns {Promise<object>} `EnquiryResponseSchema` shape
 * @throws {NotFoundError} when the property does not exist
 */
export const createEnquiry = async ({ propertyId, userId, name, email, phone, message }) => {
  await assertPropertyExists(propertyId);

  const enquiry = await prisma.enquiry.create({
    data: {
      propertyId,
      userId: userId ?? null,
      name,
      email,
      phone: phone ?? null,
      message,
    },
    include: { assignedAgent: true },
  });

  return serializeEnquiry(enquiry);
};

/**
 * @param {{ userId?: string, status?: string, propertyId?: string, assignedAgentId?: string, q?: string }} filters
 * @returns {object} a Prisma `where` clause
 */
const buildWhere = ({ userId, status, propertyId, assignedAgentId, q }) => ({
  ...(userId ? { userId } : {}),
  ...(status ? { status } : {}),
  ...(propertyId ? { propertyId } : {}),
  ...(assignedAgentId ? { assignedAgentId } : {}),
  ...(q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          // `email` is a citext column: already case-insensitive at the
          // database level, and Prisma's `mode` option does not apply to it.
          { email: { contains: q } },
          { message: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}),
});

/**
 * @param {{ where: object, page: number, limit: number, include: object, serializeRow: (row: object) => object }} args
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
const findEnquiries = async ({ where, page, limit, include, serializeRow }) => {
  const [rows, total] = await Promise.all([
    prisma.enquiry.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.enquiry.count({ where }),
  ]);

  return {
    rows: rows.map(serializeRow),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `GET /enquiries` — agent triage queue, filterable by status and property.
 * @param {{ page: number, limit: number, status?: string, propertyId?: string, assignedAgentId?: string, q?: string }} query
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export const listEnquiriesForAgent = ({ page, limit, status, propertyId, assignedAgentId, q }) =>
  findEnquiries({
    where: buildWhere({ status, propertyId, assignedAgentId, q }),
    page,
    limit,
    include: { assignedAgent: true, property: { include: COVER_MEDIA_INCLUDE } },
    serializeRow: serializeEnquiryWithProperty,
  });

/**
 * `GET /me/enquiries` — the caller's own enquiry history. Always scoped by
 * the authenticated user's id, never a client-supplied one (Section 5.3).
 * Returns the narrower `MyEnquiryWithPropertySchema` row — no agent triage
 * fields.
 * @param {{ userId: string, page: number, limit: number, status?: string, propertyId?: string }} query
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export const listMyEnquiries = ({ userId, page, limit, status, propertyId }) =>
  findEnquiries({
    where: buildWhere({ userId, status, propertyId }),
    page,
    limit,
    include: { property: { include: COVER_MEDIA_INCLUDE } },
    serializeRow: serializeMyEnquiryWithProperty,
  });

/**
 * `PATCH /enquiries/:id` — agent triage: status, assignment, notes.
 * @param {{ id: string, status?: string, assignedAgentId?: string|null, agentNotes?: string|null }} args
 * @returns {Promise<object>} `EnquiryResponseSchema` shape
 * @throws {NotFoundError} when no such enquiry exists
 */
export const updateEnquiryForAgent = async ({ id, status, assignedAgentId, agentNotes }) => {
  const existing = await prisma.enquiry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('We could not find that enquiry.');

  const enquiry = await prisma.enquiry.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(assignedAgentId !== undefined ? { assignedAgentId } : {}),
      ...(agentNotes !== undefined ? { agentNotes } : {}),
    },
    include: { assignedAgent: true },
  });

  return serializeEnquiry(enquiry);
};
