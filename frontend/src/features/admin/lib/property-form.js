import { z } from 'zod';
import { AreaUnit, PropertyType } from '@/contracts/index.js';

/**
 * Everything `PropertyForm` needs to turn `PropertyCreateSchema`/
 * `PropertyUpdateSchema` — both server-owned, imported as-is — into a form a
 * person can fill in, and back again. None of this restates a validation rule;
 * it only massages the shapes an HTML form can express (Section 9.3).
 */

/** The blank draft `PropertyForm` starts a new listing from. */
export const BLANK_PROPERTY_DRAFT = Object.freeze({
  title: '',
  description: '',
  propertyType: PropertyType.PLOT,
  price: '',
  priceIsNegotiable: false,
  areaValue: '',
  areaUnit: AreaUnit.CENT,
  addressLine: '',
  locality: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  latitude: '',
  longitude: '',
  surveyNumber: '',
  amenities: '',
  isGroupPurchase: false,
  groupTargetAmount: '',
  groupMinTicket: '',
});

/**
 * Turns a `PropertyResponseSchema` record into the same shape, so the edit
 * form's `defaultValues` and a fresh draft look identical to every input.
 * @param {object} property a `PropertyResponseSchema`-shaped record
 * @returns {typeof BLANK_PROPERTY_DRAFT}
 */
export const draftFromProperty = (property) => ({
  title: property.title,
  description: property.description ?? '',
  propertyType: property.propertyType,
  price: property.price,
  priceIsNegotiable: property.priceIsNegotiable,
  areaValue: property.areaValue,
  areaUnit: property.areaUnit,
  addressLine: property.addressLine ?? '',
  locality: property.locality ?? '',
  city: property.city,
  district: property.district ?? '',
  state: property.state,
  pincode: property.pincode ?? '',
  latitude: String(property.latitude ?? ''),
  longitude: String(property.longitude ?? ''),
  surveyNumber: property.surveyNumber ?? '',
  amenities: (property.amenities ?? []).join(', '),
  isGroupPurchase: property.isGroupPurchase,
  groupTargetAmount: property.groupTargetAmount ?? '',
  groupMinTicket: property.groupMinTicket ?? '',
});

/**
 * Preprocesses the raw form draft before it reaches the imported contract
 * schema: blanks an HTML input can never avoid producing (an untouched
 * `pincode`, `latitude`, `longitude`, or a group-purchase amount left over
 * from before the checkbox was cleared) become `undefined`, matching what the
 * schema expects for "not provided" rather than failing its format rules.
 * `amenities` — a comma-separated field in the UI — becomes the array
 * `PropertyWritableSchema` declares.
 *
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
const sanitizePropertyDraft = (raw) => {
  const value = { ...raw };

  for (const field of ['pincode', 'latitude', 'longitude', 'groupTargetAmount', 'groupMinTicket']) {
    if (value[field] === '') value[field] = undefined;
  }

  if (typeof value.amenities === 'string') {
    value.amenities = value.amenities
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  // The contract rejects a group amount on a listing that is not (or is no
  // longer) a group-purchase opportunity — clear both rather than let a
  // stale value from before the checkbox was unticked reach the schema.
  if (!value.isGroupPurchase) {
    value.groupTargetAmount = undefined;
    value.groupMinTicket = undefined;
  }

  return value;
};

/**
 * Wraps an imported contract schema (`PropertyCreateSchema` or
 * `PropertyUpdateSchema`) with the draft-to-wire preprocessing above, for use
 * as `zodResolver`'s argument. The contract itself is untouched — this only
 * runs before it (Section 9.3: do not redefine validation rules locally).
 * @param {import('zod').ZodTypeAny} contractSchema
 * @returns {import('zod').ZodTypeAny}
 */
export const propertyFormSchema = (contractSchema) => z.preprocess(sanitizePropertyDraft, contractSchema);
