import { prisma } from '../../config/prisma.js';
import { PropertyStatus, PUBLIC_PROPERTY_STATUSES, UserRole } from '../../contracts/index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { buildPaginationMeta, toPrismaPagination } from '../../utils/pagination.js';
import { toDecimalString, toIsoDateTime } from '../../utils/serialize.js';
import { generateUniqueSlug, geocodeAddress } from './properties.helpers.js';

/**
 * Business logic for `/properties` (Section 5.2). Controllers only validate,
 * call these functions, and shape the response envelope — everything that
 * touches Prisma or a rule from Section 4/11.1 lives here.
 */

/** Address columns that, if touched on a patch without new coordinates, trigger re-geocoding. */
const ADDRESS_FIELDS = ['addressLine', 'locality', 'city', 'district', 'state', 'pincode'];

/**
 * Defensive ceiling on the raw geo predicate itself — not a page size. A
 * radius search matching more rows than this reports that count as a floor
 * rather than silently presenting a truncated number as the exact total; at
 * this application's scale (a regional listings catalogue, not a
 * planet-scale one) it is not expected to be hit in practice.
 */
const RADIUS_MATCH_CEILING = 5000;

/**
 * `newest` sorts by `publishedAt`, matching the schema's only composite index
 * (`@@index([status, publishedAt(sort: Desc)])`, Section 4.2) so the status
 * filter and the sort are served by the same index instead of a separate sort
 * step.
 *
 * The public catalogue and the admin list need two different orderings here,
 * not one: Postgres's `DESC` implies `NULLS FIRST`, so a plain
 * `{ publishedAt: 'desc' }` matches the index's own ordering exactly, while
 * `{ sort: 'desc', nulls: 'last' }` does not — it is neither the index's
 * ordering nor its exact reverse, so the planner has to add a `Sort` step
 * regardless. The public catalogue never shows a `DRAFT`, so `publishedAt` is
 * never null there and the index-native ordering is free to use.
 * `listAdminProperties` does show `DRAFT`, which has no `publishedAt` yet, and
 * those belong at the end of a "newest first" list rather than sorting to the
 * top under `NULLS FIRST` — worth the extra `Sort` step on that one path.
 */
const PUBLIC_ORDER_BY_SORT = Object.freeze({
  newest: { publishedAt: 'desc' },
  priceAsc: { price: 'asc' },
  priceDesc: { price: 'desc' },
  areaDesc: { areaValue: 'desc' },
});

const ADMIN_ORDER_BY_SORT = Object.freeze({
  ...PUBLIC_ORDER_BY_SORT,
  newest: { publishedAt: { sort: 'desc', nulls: 'last' } },
});

/** Cover-only media, for the catalogue grid — cheap enough to fetch on every list row. */
const LIST_INCLUDE = Object.freeze({
  media: { where: { isCover: true }, take: 1, select: { url: true } },
});

/** Every media row plus the listing agent, for the single-property detail view. */
const DETAIL_INCLUDE = Object.freeze({
  media: { orderBy: { sortOrder: 'asc' } },
  listedByAgent: { select: { id: true, fullName: true } },
});

/** Columns a map pin needs — nothing else, since this is fetched on every viewport pan (Section 7.3). */
const MAP_SELECT = Object.freeze({
  id: true,
  slug: true,
  title: true,
  latitude: true,
  longitude: true,
  price: true,
  isGroupPurchase: true,
});

/**
 * Turns a `PropertyListItemSchema` row into its wire shape.
 * @param {object} row a Prisma property row fetched with `LIST_INCLUDE`
 * @returns {object}
 */
const serializeListItem = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  propertyType: row.propertyType,
  status: row.status,
  price: toDecimalString(row.price),
  priceIsNegotiable: row.priceIsNegotiable,
  areaValue: toDecimalString(row.areaValue),
  areaUnit: row.areaUnit,
  locality: row.locality,
  city: row.city,
  district: row.district,
  state: row.state,
  surveyNumber: row.surveyNumber,
  latitude: row.latitude,
  longitude: row.longitude,
  isGroupPurchase: row.isGroupPurchase,
  coverImageUrl: row.media?.[0]?.url ?? null,
  publishedAt: toIsoDateTime(row.publishedAt),
  createdAt: toIsoDateTime(row.createdAt),
});

/**
 * Finds the cover image among a property's media, falling back to the first
 * item by `sortOrder` when nothing is flagged as the cover.
 * @param {Array<{ url: string, isCover: boolean }>} media ordered by `sortOrder`
 * @returns {string | null}
 */
const deriveCoverImageUrl = (media) => (media.find((m) => m.isCover) ?? media[0])?.url ?? null;

/**
 * Turns a `PropertyMediaResponseSchema` row into its wire shape.
 * @param {object} m a Prisma property_media row
 * @returns {object}
 */
const serializeMedia = (m) => ({
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
 * Turns a `PropertyResponseSchema` row into its wire shape.
 * @param {object} row a Prisma property row fetched with `DETAIL_INCLUDE`
 * @returns {object}
 */
const serializeDetail = (row) => ({
  ...serializeListItem(row),
  coverImageUrl: deriveCoverImageUrl(row.media),
  description: row.description,
  addressLine: row.addressLine,
  pincode: row.pincode,
  amenities: row.amenities ?? [],
  groupTargetAmount: toDecimalString(row.groupTargetAmount),
  groupMinTicket: toDecimalString(row.groupMinTicket),
  listedByAgentId: row.listedByAgentId,
  listedByAgent: row.listedByAgent
    ? { id: row.listedByAgent.id, fullName: row.listedByAgent.fullName }
    : null,
  viewCount: row.viewCount,
  media: row.media.map(serializeMedia),
  updatedAt: toIsoDateTime(row.updatedAt),
});

/**
 * Turns a `PropertyMapPinSchema` row into its wire shape.
 * @param {object} row a Prisma property row selected with `MAP_SELECT`
 * @returns {object}
 */
const serializeMapPin = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  latitude: row.latitude,
  longitude: row.longitude,
  price: toDecimalString(row.price),
  isGroupPurchase: row.isGroupPurchase,
});

/**
 * Case-insensitive search across the fields a buyer would recognise their plot by.
 * @param {string} q
 * @returns {Array<object>} a Prisma `OR` clause
 */
const searchOr = (q) => [
  { title: { contains: q, mode: 'insensitive' } },
  { description: { contains: q, mode: 'insensitive' } },
  { locality: { contains: q, mode: 'insensitive' } },
  { city: { contains: q, mode: 'insensitive' } },
  { surveyNumber: { contains: q, mode: 'insensitive' } },
];

/**
 * Builds the `where` clause for the public catalogue. Always restricted to
 * `PUBLIC_PROPERTY_STATUSES` (Section 5.3) — a caller asking for a status
 * outside that set gets zero rows, not an error.
 * @param {object} query a parsed `PropertyListQuerySchema`
 * @returns {object} a Prisma `where` clause
 */
const buildPublicWhere = (query) => {
  const statuses = query.status
    ? PUBLIC_PROPERTY_STATUSES.filter((s) => s === query.status)
    : PUBLIC_PROPERTY_STATUSES;
  const where = { status: { in: statuses } };

  if (query.type) where.propertyType = query.type;
  if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
  if (query.locality) where.locality = { equals: query.locality, mode: 'insensitive' };
  if (query.groupPurchaseOnly) where.isGroupPurchase = true;
  if (query.areaUnit) where.areaUnit = query.areaUnit;

  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = query.minPrice;
    if (query.maxPrice) where.price.lte = query.maxPrice;
  }
  if (query.minArea || query.maxArea) {
    where.areaValue = {};
    if (query.minArea) where.areaValue.gte = query.minArea;
    if (query.maxArea) where.areaValue.lte = query.maxArea;
  }
  if (query.q) where.OR = searchOr(query.q);

  return where;
};

/**
 * Radius search — the exact pattern from Section 4.3. `ST_MakePoint` takes
 * longitude first; the radius argument is metres, not kilometres.
 * @param {{ lat: number, lng: number, radiusKm: number, limit: number }} args
 * @returns {Promise<string[]>} property ids, nearest first
 */
const radiusSearchIds = async ({ lat, lng, radiusKm, limit }) => {
  const rows = await prisma.$queryRaw`
    SELECT id FROM properties
    WHERE status = 'AVAILABLE'
      AND ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusKm * 1000})
    ORDER BY location <-> ST_MakePoint(${lng}, ${lat})::geography
    LIMIT ${limit};
  `;
  return rows.map((row) => row.id);
};

/**
 * Bounding-box search for the map viewport — the exact pattern from Section
 * 4.3, with a `LIMIT` added per the cost-control note in `PropertyMapQuerySchema`
 * so a viewport zoomed out to the whole state cannot return the entire table.
 * @param {{ minLng: number, minLat: number, maxLng: number, maxLat: number, limit: number }} args
 * @returns {Promise<string[]>} property ids
 */
const bboxSearchIds = async ({ minLng, minLat, maxLng, maxLat, limit }) => {
  const rows = await prisma.$queryRaw`
    SELECT id FROM properties
    WHERE status = 'AVAILABLE'
      AND location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
    LIMIT ${limit};
  `;
  return rows.map((row) => row.id);
};

/**
 * Radius branch of `GET /properties`. Three steps, each sized for what it
 * actually needs:
 *
 * 1. Raw SQL (Section 4.3) returns every matching id, nearest first, up to
 *    `RADIUS_MATCH_CEILING` — not a page size, so `total` below reflects the
 *    real match count rather than a page-sized truncation of it.
 * 2. An id-only Prisma query applies the non-geo filters (type, price, area,
 *    `q`, …) against that *entire* set, so `total` and the page boundaries
 *    both account for them. This is cheap: one column, no joins.
 * 3. Only the ids for the requested page are hydrated with the full
 *    `LIST_INCLUDE` (cover media) — not the whole candidate set, which
 *    previously meant page 1 of a 20-row request paid to join media for up to
 *    500 rows.
 *
 * `IN` does not preserve order, so every step re-sorts back to the distance
 * order the raw query established.
 *
 * @param {object} query a parsed `PropertyListQuerySchema` with `lat`/`lng`/`radiusKm` present
 * @returns {Promise<{ items: object[], meta: object }>}
 */
const listPropertiesByRadius = async (query) => {
  const { page, limit } = query;
  const geoIds = await radiusSearchIds({
    lat: query.lat,
    lng: query.lng,
    radiusKm: query.radiusKm,
    limit: RADIUS_MATCH_CEILING,
  });
  if (geoIds.length === 0) {
    return { items: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
  }

  const where = { ...buildPublicWhere(query), id: { in: geoIds } };
  const matched = await prisma.property.findMany({ where, select: { id: true } });
  const matchedIds = new Set(matched.map((row) => row.id));
  const orderedMatchedIds = geoIds.filter((id) => matchedIds.has(id));

  const total = orderedMatchedIds.length;
  const start = (page - 1) * limit;
  const pageIds = orderedMatchedIds.slice(start, start + limit);

  if (pageIds.length === 0) {
    return { items: [], meta: buildPaginationMeta({ page, limit, total }) };
  }

  const rows = await prisma.property.findMany({
    where: { id: { in: pageIds } },
    include: LIST_INCLUDE,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pageItems = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return {
    items: pageItems.map(serializeListItem),
    meta: buildPaginationMeta({ page, limit, total }),
  };
};

/**
 * `GET /properties` — the public, filtered catalogue.
 * @param {object} query a parsed `PropertyListQuerySchema`
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export const listProperties = async (query) => {
  if (query.lat !== undefined) {
    return listPropertiesByRadius(query);
  }

  const { page, limit } = query;
  const where = buildPublicWhere(query);
  const orderBy = PUBLIC_ORDER_BY_SORT[query.sort];

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy,
      include: LIST_INCLUDE,
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.property.count({ where }),
  ]);

  return { items: rows.map(serializeListItem), meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * `GET /properties/admin/list` — every status, optionally narrowed to the
 * caller's own listings (Section 5.2). Any agent or admin may see any
 * property here; `mine` is the only per-caller narrowing.
 * @param {object} query a parsed `PropertyAdminListQuerySchema`
 * @param {{ id: string, role: string }} actor
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export const listAdminProperties = async (query, actor) => {
  const { page, limit } = query;
  const where = {};
  if (query.status) where.status = query.status;
  if (query.type) where.propertyType = query.type;
  if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
  if (query.groupPurchaseOnly) where.isGroupPurchase = true;
  if (query.mine) where.listedByAgentId = actor.id;
  if (query.q) where.OR = searchOr(query.q);

  const orderBy = ADMIN_ORDER_BY_SORT[query.sort];

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy,
      include: LIST_INCLUDE,
      ...toPrismaPagination({ page, limit }),
    }),
    prisma.property.count({ where }),
  ]);

  return { items: rows.map(serializeListItem), meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * `GET /properties/map` — lightweight pins for the viewport (Section 7.3).
 * @param {object} query a parsed `PropertyMapQuerySchema`
 * @returns {Promise<object[]>}
 */
export const getPropertiesMap = async (query) => {
  const ids = await bboxSearchIds({
    minLng: query.minLng,
    minLat: query.minLat,
    maxLng: query.maxLng,
    maxLat: query.maxLat,
    limit: query.limit,
  });
  if (ids.length === 0) return [];

  const where = { id: { in: ids } };
  if (query.type) where.propertyType = query.type;
  if (query.groupPurchaseOnly) where.isGroupPurchase = true;

  const rows = await prisma.property.findMany({ where, select: MAP_SELECT });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(serializeMapPin);
};

/**
 * How long a single (viewer, property) pair counts as one view before another
 * increment is recorded. `GET /properties/:slug` is public, unauthenticated
 * and otherwise unthrottled, so without this a refresh loop can inflate a
 * listing's view count and, on a busy listing, drive an `UPDATE` on every
 * request. Session-less by design — the key is the caller's address, not a
 * cookie — so this needs no new column and works for anonymous traffic. Short
 * enough that a genuine return visit still registers, long enough to blunt a
 * naive script.
 */
const VIEW_DEBOUNCE_WINDOW_MS = 60 * 1000;

/** Bounds the in-memory debounce map so an unbounded stream of distinct callers cannot grow it forever. */
const MAX_VIEW_DEBOUNCE_ENTRIES = 20_000;

/** `${propertyId}:${viewerKey}` -> epoch ms of the last counted view. */
const recentViewers = new Map();

/**
 * Whether this viewer's hit on this property should be counted, given the
 * debounce window above.
 * @param {string} propertyId
 * @param {string} viewerKey caller's IP address, or another stable-enough identifier
 * @returns {boolean}
 */
const shouldCountView = (propertyId, viewerKey) => {
  const key = `${propertyId}:${viewerKey}`;
  const now = Date.now();
  const lastSeen = recentViewers.get(key);
  if (lastSeen !== undefined && now - lastSeen < VIEW_DEBOUNCE_WINDOW_MS) {
    return false;
  }
  if (recentViewers.size >= MAX_VIEW_DEBOUNCE_ENTRIES) {
    // Coarse eviction rather than an unbounded map. Worst case this costs one
    // extra counted view for whoever is mid-window when it happens.
    recentViewers.clear();
  }
  recentViewers.set(key, now);
  return true;
};

/**
 * `GET /properties/:slug` — full detail. Increments the view count, subject
 * to `shouldCountView`'s per-viewer debounce.
 *
 * Agents and admins may preview a `DRAFT` or `WITHDRAWN` listing by slug;
 * everyone else gets `NOT_FOUND` rather than a leak of the listing's
 * existence (Section 5.3's 403-not-404 rule is about another user's own
 * records — a draft is agency-internal, not personal data, so hiding it
 * entirely is the safer default).
 *
 * @param {string} slug
 * @param {{ id: string, role: string } | undefined} actor the caller, if authenticated
 * @param {string} [viewerKey] caller's IP address; a missing key is never debounced
 * @returns {Promise<object>} `PropertyResponseSchema`-shaped
 * @throws {NotFoundError}
 */
export const getPropertyBySlug = async (slug, actor, viewerKey) => {
  const property = await prisma.property.findUnique({ where: { slug }, include: DETAIL_INCLUDE });
  const canSeeAllStatuses = actor?.role === UserRole.AGENT || actor?.role === UserRole.ADMIN;

  if (!property || (!canSeeAllStatuses && !PUBLIC_PROPERTY_STATUSES.includes(property.status))) {
    throw new NotFoundError('We could not find that listing.');
  }

  if (!viewerKey || !shouldCountView(property.id, viewerKey)) {
    return serializeDetail(property);
  }

  const bumped = await prisma.property.update({
    where: { id: property.id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  return serializeDetail({ ...property, viewCount: bumped.viewCount });
};

/**
 * Whether a slug is already taken — the `exists` check `generateUniqueSlug` needs.
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
const propertySlugExists = async (slug) => {
  const found = await prisma.property.findUnique({ where: { slug }, select: { id: true } });
  return found !== null;
};

/**
 * `POST /properties` — creates a listing in `DRAFT` (Section 5.2).
 * @param {object} body a parsed `PropertyCreateSchema`
 * @param {{ id: string, role: string }} actor the creating agent
 * @returns {Promise<object>} `PropertyResponseSchema`-shaped
 */
export const createProperty = async (body, actor) => {
  const slug = await generateUniqueSlug(body.title, { exists: propertySlugExists });

  let { latitude, longitude } = body;
  if (latitude === undefined || longitude === undefined) {
    const coords = await geocodeAddress(body);
    latitude = coords.latitude;
    longitude = coords.longitude;
  }

  const created = await prisma.property.create({
    data: {
      slug,
      title: body.title,
      description: body.description ?? null,
      propertyType: body.propertyType,
      status: PropertyStatus.DRAFT,
      price: body.price,
      priceIsNegotiable: body.priceIsNegotiable ?? false,
      areaValue: body.areaValue,
      areaUnit: body.areaUnit,
      addressLine: body.addressLine ?? null,
      locality: body.locality ?? null,
      city: body.city,
      district: body.district ?? null,
      state: body.state,
      pincode: body.pincode ?? null,
      latitude,
      longitude,
      surveyNumber: body.surveyNumber ?? null,
      amenities: body.amenities ?? [],
      isGroupPurchase: body.isGroupPurchase ?? false,
      groupTargetAmount: body.groupTargetAmount ?? null,
      groupMinTicket: body.groupMinTicket ?? null,
      listedByAgentId: actor.id,
    },
    include: DETAIL_INCLUDE,
  });

  return serializeDetail(created);
};

/**
 * The group-purchase pairing rule the contract comment defers to the service
 * (`property.contract.js`): `groupTargetAmount`/`groupMinTicket` may only be
 * set while the property is, or is becoming, a group-purchase opportunity.
 * @param {object} body a parsed `PropertyUpdateSchema`
 * @param {{ isGroupPurchase: boolean }} existing the stored property
 * @returns {void}
 * @throws {ValidationError}
 */
const assertGroupPurchasePairing = (body, existing) => {
  const nextIsGroupPurchase = body.isGroupPurchase ?? existing.isGroupPurchase;
  if (nextIsGroupPurchase) return;

  for (const field of ['groupTargetAmount', 'groupMinTicket']) {
    if (body[field] !== undefined && body[field] !== null) {
      throw new ValidationError('Only applies to a group purchase opportunity', [
        { field, message: 'Only applies to a group purchase opportunity' },
      ]);
    }
  }
};

/**
 * `PATCH /properties/:id`. Any agent or admin may edit any listing
 * (Section 5.3). Two decisions the contract leaves to this service:
 *
 * - Turning `isGroupPurchase` off clears any stale target/ticket amount that
 *   the same patch did not also set, so a withdrawn group-purchase flag never
 *   leaves a dangling figure on the record.
 * - Coordinates are only re-geocoded when the patch touches an address field
 *   without also supplying both `latitude` and `longitude` directly — not on
 *   every patch, which would force every price or description edit through
 *   geocoding (and fail outright with no API key configured, Section 7.3).
 *
 * @param {string} id
 * @param {object} body a parsed `PropertyUpdateSchema`
 * @returns {Promise<object>} `PropertyResponseSchema`-shaped
 * @throws {NotFoundError} unknown id
 * @throws {ValidationError} group-purchase pairing violation
 */
export const updateProperty = async (id, body) => {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('That listing could not be found.');

  assertGroupPurchasePairing(body, existing);

  const data = { ...body };

  if (body.isGroupPurchase === false) {
    if (body.groupTargetAmount === undefined) data.groupTargetAmount = null;
    if (body.groupMinTicket === undefined) data.groupMinTicket = null;
  }

  const hasBothCoordinates = body.latitude !== undefined && body.longitude !== undefined;
  const addressTouched = ADDRESS_FIELDS.some((field) => body[field] !== undefined);
  if (!hasBothCoordinates && addressTouched) {
    const merged = { ...existing, ...body };
    const coords = await geocodeAddress(merged);
    data.latitude = coords.latitude;
    data.longitude = coords.longitude;
  }

  const updated = await prisma.property.update({ where: { id }, data, include: DETAIL_INCLUDE });
  return serializeDetail(updated);
};

/**
 * `POST /properties/:id/publish` — `DRAFT` to `AVAILABLE`, sets `publishedAt`.
 * @param {string} id
 * @returns {Promise<object>} `PropertyResponseSchema`-shaped
 * @throws {NotFoundError} unknown id
 * @throws {ConflictError} the listing is not currently a draft
 */
export const publishProperty = async (id) => {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('That listing could not be found.');
  if (existing.status !== PropertyStatus.DRAFT) {
    throw new ConflictError('Only a draft listing can be published.');
  }

  const updated = await prisma.property.update({
    where: { id },
    data: { status: PropertyStatus.AVAILABLE, publishedAt: new Date() },
    include: DETAIL_INCLUDE,
  });
  return serializeDetail(updated);
};

/**
 * `DELETE /properties/:id` — a soft delete to `WITHDRAWN`, admin-only.
 * @param {string} id
 * @returns {Promise<object>} `PropertyResponseSchema`-shaped
 * @throws {NotFoundError} unknown id
 * @throws {ConflictError} the listing is already withdrawn
 */
export const withdrawProperty = async (id) => {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('That listing could not be found.');
  if (existing.status === PropertyStatus.WITHDRAWN) {
    throw new ConflictError('That listing has already been withdrawn.');
  }

  const updated = await prisma.property.update({
    where: { id },
    data: { status: PropertyStatus.WITHDRAWN },
    include: DETAIL_INCLUDE,
  });
  return serializeDetail(updated);
};
