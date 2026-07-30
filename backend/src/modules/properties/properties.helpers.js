import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { ConflictError, ValidationError } from '../../utils/app-error.js';

/**
 * Slug generation and server-side geocoding for the properties module
 * (Section 11.1 slug uniqueness, Section 7.3 geocoding).
 */

/** `slug varchar(160)` (Section 4.2). */
const MAX_SLUG_LENGTH = 160;

/**
 * Hex-encoded random suffix appended to every slug. Hex digits are already
 * lowercase `0-9a-f`, so the result satisfies `SlugParamSchema`'s
 * `^[a-z0-9-]+$` without any further escaping.
 */
const SUFFIX_LENGTH = 8;

/** Collision is astronomically unlikely with an 8-hex-char suffix; this bounds retries rather than looping forever. */
const MAX_GENERATION_ATTEMPTS = 5;

/**
 * Turns a title into the lowercase, hyphenated base of a slug. Diacritics are
 * stripped rather than dropped outright, so "Ooty" survives an accented
 * variant instead of losing the whole word.
 * @param {string} title
 * @returns {string} always non-empty
 */
// Combining diacritical marks block (U+0300–U+036F), built from char codes so
// the source file stays plain ASCII rather than embedding the marks literally.
const COMBINING_MARKS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

export const slugifyTitle = (title) => {
  const base = title
    .normalize('NFKD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'plot';
};

/**
 * An 8-character lowercase hex suffix.
 * @returns {string}
 */
const randomSuffix = () => randomBytes(SUFFIX_LENGTH).toString('hex').slice(0, SUFFIX_LENGTH);

/**
 * Generates a unique, ≤160-character slug for a property title.
 *
 * The uniqueness check is injected rather than imported, so the collision
 * retry path (Section 11.1) can be unit-tested without a database.
 *
 * @param {string} title
 * @param {{ exists: (candidate: string) => Promise<boolean> }} deps
 * @returns {Promise<string>}
 * @throws {ConflictError} if no unique slug is found within a bounded number of attempts
 */
export const generateUniqueSlug = async (title, { exists }) => {
  const base = slugifyTitle(title).slice(0, MAX_SLUG_LENGTH - SUFFIX_LENGTH - 1);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = `${base}-${randomSuffix()}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new ConflictError('Could not generate a unique address for this listing. Try again.');
};

/** Address fields a geocoding request is built from. */
const ADDRESS_FIELDS = ['addressLine', 'locality', 'city', 'district', 'state', 'pincode'];

/**
 * Builds the free-text query Google's Geocoding API expects from the address
 * columns on `properties` (Section 4.2).
 * @param {Record<string, string | null | undefined>} address
 * @returns {string}
 */
const buildAddressQuery = (address) =>
  ADDRESS_FIELDS.map((field) => address[field]).filter(Boolean).join(', ');

/**
 * Server-side geocoding for listing create/update (Section 7.3). Never called
 * from the browser, and its result is persisted rather than looked up again.
 *
 * `apiKey` and `fetchImpl` default to the real environment and the global
 * `fetch`, and exist as parameters purely so tests can override them without
 * touching the network or `config/env.js` (Section 7.3, and the WP2 lead
 * decision: an unset key must fail loudly rather than store a placeholder).
 *
 * @param {{ addressLine?: string|null, locality?: string|null, city: string, district?: string|null, state: string, pincode?: string|null }} address
 * @param {{ fetchImpl?: typeof fetch, apiKey?: string }} [deps]
 * @returns {Promise<{ latitude: number, longitude: number }>}
 * @throws {ValidationError} when no API key is configured, or the address cannot be resolved
 */
export const geocodeAddress = async (
  address,
  { fetchImpl = fetch, apiKey = env.GEOCODING_API_KEY } = {},
) => {
  if (!apiKey) {
    throw new ValidationError(
      'Automatic geocoding is not available. Supply latitude and longitude for this listing.',
      [
        { field: 'latitude', message: 'Latitude is required when an address cannot be geocoded' },
        {
          field: 'longitude',
          message: 'Longitude is required when an address cannot be geocoded',
        },
      ],
    );
  }

  const query = buildAddressQuery(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new ValidationError(
      'Could not verify that address right now. Supply latitude and longitude directly.',
    );
  }

  const body = await response.json();
  const location = body?.results?.[0]?.geometry?.location;
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw new ValidationError(
      'Could not determine coordinates for that address. Supply latitude and longitude directly.',
      [{ field: 'latitude', message: 'The address could not be geocoded' }],
    );
  }

  return { latitude: location.lat, longitude: location.lng };
};
