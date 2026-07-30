import { z } from 'zod';
import { AreaUnitSchema, PropertyStatusSchema, PropertyTypeSchema } from './enums.js';
import {
  AreaValueSchema,
  BooleanQuerySchema,
  IsoDateTimeSchema,
  LatitudeSchema,
  LongitudeSchema,
  MoneySchema,
  optionalParam,
  PaginationQuerySchema,
  PositiveMoneySchema,
  UuidSchema,
} from './common.contract.js';
import { PropertyMediaResponseSchema } from './media.contract.js';
import { UserSummarySchema } from './auth.contract.js';

/**
 * Property listings — `/properties` in Section 5.2, backed by the `properties`
 * table in Section 4.2.
 *
 * `boundary` is absent from every schema here: the column exists but the MVP
 * ships no drawing tool (Section 15, open decision 4).
 */

export const PropertySortSchema = z.enum(['newest', 'priceAsc', 'priceDesc', 'areaDesc']);

/**
 * The writable fields of a property. Not exported — `PropertyCreateSchema` and
 * `PropertyUpdateSchema` are the two shapes routes actually validate against.
 *
 * `slug`, `status`, `viewCount` and `publishedAt` are server-owned: slugs are
 * generated, status moves through `POST /properties/:id/publish` and
 * `DELETE /properties/:id`, and the counter is incremented on detail reads.
 */
const PropertyWritableSchema = z.object({
  title: z.string().trim().min(4, 'Enter a title of at least 4 characters').max(160),
  description: z.string().trim().max(8000).nullable().optional(),
  propertyType: PropertyTypeSchema,
  price: PositiveMoneySchema,
  priceIsNegotiable: z.boolean().optional(),
  areaValue: AreaValueSchema,
  areaUnit: AreaUnitSchema,
  addressLine: z.string().trim().max(255).nullable().optional(),
  locality: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().min(2).max(120),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter a 6-digit pincode')
    .nullable()
    .optional(),
  // Optional because geocoding runs server-side at create/update time
  // (Section 7.3). Supply both to pin the plot exactly, or neither to have the
  // address geocoded and persisted.
  latitude: LatitudeSchema.optional(),
  longitude: LongitudeSchema.optional(),
  surveyNumber: z.string().trim().max(80).nullable().optional(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  isGroupPurchase: z.boolean().optional(),
  groupTargetAmount: MoneySchema.nullable().optional(),
  groupMinTicket: MoneySchema.nullable().optional(),
});

/**
 * Coordinates are meaningless one at a time — the trigger builds a point from
 * both columns.
 * @param {{ latitude?: number, longitude?: number }} value
 * @param {import('zod').RefinementCtx} ctx
 * @returns {void}
 */
const requireCoordinatePair = (value, ctx) => {
  const hasLat = value.latitude !== undefined && value.latitude !== null;
  const hasLng = value.longitude !== undefined && value.longitude !== null;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasLat ? 'longitude' : 'latitude'],
      message: 'Provide both latitude and longitude, or neither',
    });
  }
};

export const PropertyCreateSchema = PropertyWritableSchema.superRefine((value, ctx) => {
  requireCoordinatePair(value, ctx);
  if (!value.isGroupPurchase) {
    for (const field of ['groupTargetAmount', 'groupMinTicket']) {
      if (value[field] !== undefined && value[field] !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'Only applies to a group purchase opportunity',
        });
      }
    }
  }
});

/**
 * `PATCH /properties/:id`. The group-purchase pairing rule from create is not
 * repeated: a patch may set an amount on a property that is already flagged,
 * without resending the flag. The service enforces it against stored state.
 */
export const PropertyUpdateSchema = PropertyWritableSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  })
  .superRefine(requireCoordinatePair);

/** Identity-strip fields (Section 7.2) plus enough to render a catalogue card. */
export const PropertyListItemSchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  title: z.string(),
  propertyType: PropertyTypeSchema,
  status: PropertyStatusSchema,
  price: MoneySchema,
  priceIsNegotiable: z.boolean(),
  areaValue: AreaValueSchema,
  areaUnit: AreaUnitSchema,
  locality: z.string().nullable(),
  city: z.string(),
  district: z.string().nullable(),
  state: z.string(),
  surveyNumber: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  isGroupPurchase: z.boolean(),
  coverImageUrl: z.string().nullable(),
  publishedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});

export const PropertyListResponseSchema = z.array(PropertyListItemSchema);

/** Compact projection embedded in enquiry, visit, saved and interest rows. */
export const PropertySummarySchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  title: z.string(),
  status: PropertyStatusSchema,
  price: MoneySchema,
  areaValue: AreaValueSchema,
  areaUnit: AreaUnitSchema,
  locality: z.string().nullable(),
  city: z.string(),
  surveyNumber: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
});

export const PropertyResponseSchema = PropertyListItemSchema.extend({
  description: z.string().nullable(),
  addressLine: z.string().nullable(),
  pincode: z.string().nullable(),
  amenities: z.array(z.string()),
  groupTargetAmount: MoneySchema.nullable(),
  groupMinTicket: MoneySchema.nullable(),
  listedByAgentId: UuidSchema.nullable(),
  listedByAgent: UserSummarySchema.nullable(),
  viewCount: z.number().int().min(0),
  media: z.array(PropertyMediaResponseSchema),
  updatedAt: IsoDateTimeSchema,
});

/** `GET /properties` query parameters (Section 5.2). */
export const PropertyListQuerySchema = PaginationQuerySchema.extend({
  q: optionalParam(z.string().trim().min(1).max(160)),
  type: optionalParam(PropertyTypeSchema),
  status: optionalParam(PropertyStatusSchema),
  minPrice: optionalParam(MoneySchema),
  maxPrice: optionalParam(MoneySchema),
  minArea: optionalParam(AreaValueSchema),
  maxArea: optionalParam(AreaValueSchema),
  areaUnit: optionalParam(AreaUnitSchema),
  city: optionalParam(z.string().trim().min(1).max(120)),
  locality: optionalParam(z.string().trim().min(1).max(120)),
  groupPurchaseOnly: optionalParam(BooleanQuerySchema),
  lat: optionalParam(LatitudeSchema),
  lng: optionalParam(LongitudeSchema),
  radiusKm: optionalParam(z.coerce.number().positive().max(200)),
  sort: PropertySortSchema.default('newest'),
}).superRefine((value, ctx) => {
  const geoFields = ['lat', 'lng', 'radiusKm'];
  const supplied = geoFields.filter((field) => value[field] !== undefined);
  if (supplied.length > 0 && supplied.length < geoFields.length) {
    for (const field of geoFields) {
      if (value[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'Radius search needs lat, lng and radiusKm together',
        });
      }
    }
  }
  if (value.minPrice && value.maxPrice && Number(value.minPrice) > Number(value.maxPrice)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minPrice'],
      message: 'Minimum price cannot exceed maximum price',
    });
  }
  if (value.minArea && value.maxArea && Number(value.minArea) > Number(value.maxArea)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minArea'],
      message: 'Minimum area cannot exceed maximum area',
    });
  }
});

/**
 * `GET /properties/map`. Parameter order matches
 * `ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)` in Section 4.3.
 */
export const PropertyMapQuerySchema = z
  .object({
    minLng: LongitudeSchema,
    minLat: LatitudeSchema,
    maxLng: LongitudeSchema,
    maxLat: LatitudeSchema,
    type: optionalParam(PropertyTypeSchema),
    groupPurchaseOnly: optionalParam(BooleanQuerySchema),
    // Pins are cheap but a viewport zoomed out to the whole state must not
    // return the entire table (Section 7.3).
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .superRefine((value, ctx) => {
    if (value.minLng >= value.maxLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minLng'],
        message: 'minLng must be less than maxLng',
      });
    }
    if (value.minLat >= value.maxLat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minLat'],
        message: 'minLat must be less than maxLat',
      });
    }
  });

/** One map pin — kept deliberately small, this response is fetched on every pan. */
export const PropertyMapPinSchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  title: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  price: MoneySchema,
  isGroupPurchase: z.boolean(),
});

export const PropertyMapResponseSchema = z.array(PropertyMapPinSchema);

/** `GET /properties/admin/list` — all statuses; `mine` narrows to the caller's listings. */
export const PropertyAdminListQuerySchema = PaginationQuerySchema.extend({
  q: optionalParam(z.string().trim().min(1).max(160)),
  status: optionalParam(PropertyStatusSchema),
  type: optionalParam(PropertyTypeSchema),
  city: optionalParam(z.string().trim().min(1).max(120)),
  groupPurchaseOnly: optionalParam(BooleanQuerySchema),
  mine: optionalParam(BooleanQuerySchema),
  sort: PropertySortSchema.default('newest'),
});
