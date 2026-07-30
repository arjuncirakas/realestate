/**
 * Fixed values from the spec that are not environment-dependent. Kept here so
 * no module has to restate a number the requirements already pinned down.
 */

/** Every route lives under this prefix (Section 5). */
export const API_PREFIX = '/api/v1';

/** bcrypt cost factor (Section 6). */
export const BCRYPT_COST = 12;

/** Where locally stored uploads are served from. */
export const UPLOADS_ROUTE = '/uploads';

/**
 * Storage key prefixes, one per kind of upload, so objects stay grouped in the
 * bucket and a stray key is easy to attribute.
 */
export const STORAGE_PREFIX = Object.freeze({
  propertyMedia: 'property-media',
  logMedia: 'log-media',
  snapshots: 'plot-snapshots',
});

/** Rate limits from Section 6, per IP. */
export const RATE_LIMITS = Object.freeze({
  auth: Object.freeze({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: 'Too many attempts. Wait 15 minutes and try again.',
  }),
  enquiry: Object.freeze({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: 'Too many enquiries from this connection. Try again in an hour.',
  }),
});

/** Largest JSON body the API accepts. Uploads go through multer, not here. */
export const JSON_BODY_LIMIT = '256kb';
