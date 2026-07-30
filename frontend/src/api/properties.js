import { useQuery } from '@tanstack/react-query';
import { PropertyListQuerySchema, PropertyMapQuerySchema } from '@/contracts/index.js';
import { api, unwrap, unwrapList } from './client.js';

/**
 * React Query hooks for `/properties` (Section 9.3: one hook per endpoint,
 * components never call axios directly).
 */

/** Bounding-box coordinates are rounded to this many decimals before they enter
 * a query key, so a one-pixel pan does not invalidate the cache (Section 7.3). */
const MAP_BOUNDS_PRECISION = 3;

/**
 * Rounds a Google Maps camera bounds literal down to the Section 7.3 cache key
 * shape, renaming `north/south/east/west` to the `minLng/minLat/maxLng/maxLat`
 * names `PropertyMapQuerySchema` and the Section 4.3 bounding-box query expect.
 *
 * @param {{ north: number, south: number, east: number, west: number } | null} bounds
 * @returns {{ minLng: number, minLat: number, maxLng: number, maxLat: number } | null}
 */
export const roundMapBounds = (bounds) => {
  if (!bounds) return null;
  const factor = 10 ** MAP_BOUNDS_PRECISION;
  const round = (value) => Math.round(value * factor) / factor;
  return {
    minLng: round(bounds.west),
    minLat: round(bounds.south),
    maxLng: round(bounds.east),
    maxLat: round(bounds.north),
  };
};

/**
 * The paginated, filtered plot catalogue — `GET /properties`.
 *
 * Takes the raw filter state (everything as a string, the shape a form or a
 * URL search param produces) and validates it against `PropertyListQuerySchema`
 * rather than hand-rolling the check. A combination the contract itself
 * rejects — `minPrice` above `maxPrice`, for instance — is reported through
 * `validationError` with the contract's own message, instead of throwing or
 * silently sending a request the server would 400 on.
 *
 * @param {Record<string, string | boolean | number | undefined>} filters
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const usePropertiesList = (filters) => {
  const parsed = PropertyListQuerySchema.safeParse(filters ?? {});
  const query = parsed.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['properties', 'list', query],
    queryFn: async () => unwrapList(await api.get('/properties', { params: query })),
    enabled: Boolean(query),
  });

  return { ...result, validationError: parsed.success ? null : parsed.error };
};

/**
 * A single plot's full record — `GET /properties/:slug`. Also increments the
 * listing's view count server-side (subject to the API's own debounce).
 *
 * @param {string | undefined} slug
 * @returns {import('@tanstack/react-query').UseQueryResult<object>}
 */
export const usePropertyDetail = (slug) =>
  useQuery({
    queryKey: ['properties', 'detail', slug],
    queryFn: async () => unwrap(await api.get(`/properties/${slug}`)),
    enabled: Boolean(slug),
  });

/**
 * Lightweight pins for the map viewport — `GET /properties/map`.
 *
 * `bounds` is the raw, un-rounded camera bounds; callers debounce viewport
 * changes at 500ms before passing them in (Section 7.3) — this hook only
 * handles the rounding and the 5-minute cache. Disabled entirely, with no
 * network call, until `bounds` is supplied.
 *
 * @param {{ north: number, south: number, east: number, west: number } | null} bounds
 * @param {{ type?: string, groupPurchaseOnly?: boolean | string }} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const usePropertyMap = (bounds, options = {}) => {
  const rounded = roundMapBounds(bounds);
  const raw = rounded ? { ...rounded, type: options.type, groupPurchaseOnly: options.groupPurchaseOnly } : null;
  const parsed = raw ? PropertyMapQuerySchema.safeParse(raw) : null;
  const query = parsed?.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['properties', 'map', query],
    queryFn: async () => unwrapList(await api.get('/properties/map', { params: query })),
    enabled: Boolean(query),
    // Section 7.3: cache viewport results for 5 minutes rather than refetching
    // on every render — panning back to a recently seen area costs nothing.
    staleTime: 5 * 60 * 1000,
  });

  return { ...result, validationError: parsed && !parsed.success ? parsed.error : null };
};
