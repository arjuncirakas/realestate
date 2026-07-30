import { prisma } from '../../config/prisma.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { toDecimalString, toIsoDate, toIsoDateTime } from '../../utils/serialize.js';

/**
 * Serialisers and access checks shared by the ownership and logs modules
 * (both owned by this work package, Section 13). A property and its
 * ownerships are the anchor both modules read from, so this file — rather
 * than the properties module, which is a different work package and not on
 * an import path available to us — is the one place that projects a Prisma
 * property/ownership row into the `PropertySummarySchema`, `PropertyResponseSchema`
 * and `OwnershipResponseSchema` shapes this package needs.
 */

/** Cover-only media, for the compact property projection embedded in list rows. */
export const PROPERTY_COVER_INCLUDE = Object.freeze({
  media: { where: { isCover: true }, take: 1, select: { url: true } },
});

/** Every media row plus the listing agent, for the single-property owner detail view. */
export const PROPERTY_DETAIL_INCLUDE = Object.freeze({
  media: { orderBy: { sortOrder: 'asc' } },
  listedByAgent: { select: { id: true, fullName: true } },
});

/** The owning user's name, embedded in every `OwnershipResponseSchema` row. */
export const OWNER_USER_INCLUDE = Object.freeze({
  ownerUser: { select: { id: true, fullName: true } },
});

/**
 * Turns a property row (fetched with `PROPERTY_COVER_INCLUDE`) into the
 * `PropertySummarySchema` shape embedded in `OwnedPropertyListItemSchema`.
 * @param {object} property Prisma property row
 * @returns {object}
 */
export const serializePropertySummary = (property) => ({
  id: property.id,
  slug: property.slug,
  title: property.title,
  status: property.status,
  price: toDecimalString(property.price),
  areaValue: toDecimalString(property.areaValue),
  areaUnit: property.areaUnit,
  locality: property.locality,
  city: property.city,
  surveyNumber: property.surveyNumber,
  coverImageUrl: property.media?.[0]?.url ?? null,
});

/**
 * Finds the cover image among a property's media, falling back to the first
 * item by `sortOrder` when nothing is flagged as the cover.
 * @param {Array<{ url: string, isCover: boolean }>} media ordered by `sortOrder`
 * @returns {string | null}
 */
const deriveCoverImageUrl = (media) => (media.find((m) => m.isCover) ?? media[0])?.url ?? null;

/**
 * @param {object} m a Prisma property_media row
 * @returns {object} `PropertyMediaResponseSchema` shape
 */
const serializePropertyMedia = (m) => ({
  id: m.id,
  propertyId: m.propertyId,
  type: m.type,
  url: m.url,
  caption: m.caption,
  sortOrder: m.sortOrder,
  isCover: m.isCover,
  createdAt: toIsoDateTime(m.createdAt),
});

/**
 * Turns a property row (fetched with `PROPERTY_DETAIL_INCLUDE`) into the
 * `PropertyResponseSchema` shape embedded in `OwnedPropertyDetailSchema`.
 * @param {object} property Prisma property row
 * @returns {object}
 */
export const serializePropertyDetail = (property) => ({
  id: property.id,
  slug: property.slug,
  title: property.title,
  propertyType: property.propertyType,
  status: property.status,
  price: toDecimalString(property.price),
  priceIsNegotiable: property.priceIsNegotiable,
  areaValue: toDecimalString(property.areaValue),
  areaUnit: property.areaUnit,
  locality: property.locality,
  city: property.city,
  district: property.district,
  state: property.state,
  surveyNumber: property.surveyNumber,
  latitude: property.latitude,
  longitude: property.longitude,
  isGroupPurchase: property.isGroupPurchase,
  coverImageUrl: deriveCoverImageUrl(property.media),
  publishedAt: toIsoDateTime(property.publishedAt),
  createdAt: toIsoDateTime(property.createdAt),
  description: property.description,
  addressLine: property.addressLine,
  pincode: property.pincode,
  amenities: property.amenities ?? [],
  groupTargetAmount: toDecimalString(property.groupTargetAmount),
  groupMinTicket: toDecimalString(property.groupMinTicket),
  listedByAgentId: property.listedByAgentId,
  listedByAgent: property.listedByAgent
    ? { id: property.listedByAgent.id, fullName: property.listedByAgent.fullName }
    : null,
  viewCount: property.viewCount,
  media: property.media.map(serializePropertyMedia),
  updatedAt: toIsoDateTime(property.updatedAt),
});

/**
 * Turns an ownership row (fetched with `OWNER_USER_INCLUDE`) into the
 * `OwnershipResponseSchema` shape.
 * @param {object} ownership Prisma ownership row
 * @returns {object}
 */
export const serializeOwnership = (ownership) => ({
  id: ownership.id,
  propertyId: ownership.propertyId,
  ownerUserId: ownership.ownerUserId,
  ownerUser: ownership.ownerUser
    ? { id: ownership.ownerUser.id, fullName: ownership.ownerUser.fullName }
    : null,
  sharePercentage: toDecimalString(ownership.sharePercentage),
  registeredOn: toIsoDate(ownership.registeredOn),
  documentRef: ownership.documentRef,
  notes: ownership.notes,
  createdAt: toIsoDateTime(ownership.createdAt),
  updatedAt: toIsoDateTime(ownership.updatedAt),
});

/**
 * @param {string} propertyId
 * @returns {Promise<void>}
 * @throws {NotFoundError} when no such property exists
 */
export const assertPropertyExists = async (propertyId) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) throw new NotFoundError('We could not find that property.');
};

/**
 * The check every `/me/properties*` route needs (Section 5.3): the caller
 * must appear in `ownerships` for the property, and a caller who is simply
 * not an owner gets a 403, never a 404 that would leak whether the property
 * exists. A missing property itself is still a genuine 404 — that is about
 * the property, not about who is allowed to see it.
 * @param {{ propertyId: string, userId: string }} args
 * @returns {Promise<void>}
 * @throws {NotFoundError} when no such property exists
 * @throws {ForbiddenError} when the caller does not own a share of it
 */
export const assertOwnerAccess = async ({ propertyId, userId }) => {
  await assertPropertyExists(propertyId);

  const ownership = await prisma.ownership.findUnique({
    where: { propertyId_ownerUserId: { propertyId, ownerUserId: userId } },
    select: { id: true },
  });
  if (!ownership) {
    throw new ForbiddenError('You do not have access to this property.');
  }
};
