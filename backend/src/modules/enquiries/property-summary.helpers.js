import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../utils/app-error.js';
import { toDecimalString } from '../../utils/serialize.js';

/**
 * Shared across the four engagement modules (enquiries, visits, saved,
 * interests): every one of them embeds a `PropertySummarySchema` in its list
 * rows and needs to 404 on a property id that does not exist. Living here
 * rather than duplicated four times means `PropertySummarySchema` changing
 * shape is a one-file fix, not four files edited in lockstep. All four
 * modules are owned by this work package, so the cross-module import stays
 * inside `backend/src/modules/{enquiries,visits,saved,interests}/**`.
 */

/** Loads only the cover image, so a list row never pulls the whole gallery. */
export const COVER_MEDIA_INCLUDE = { media: { where: { isCover: true }, take: 1 } };

/**
 * Projects a property row into the `PropertySummarySchema` shape embedded in
 * every engagement list row.
 * @param {object} property Prisma property row, with `media` loaded per `COVER_MEDIA_INCLUDE`
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
