import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PropertyAdminListQuerySchema } from '@/contracts/index.js';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Agency-facing property endpoints (Section 5.2): the admin listing table,
 * create, update, publish and withdraw. The public catalogue's own hooks
 * (`GET /properties`, `GET /properties/:slug`, `GET /properties/map`) belong
 * to WP7's `properties.js` — `usePropertyDetail` from there is reused as-is
 * for loading a single listing's full record here, since it is the same
 * endpoint either way (Section 5.2 notes agents may preview any status by slug).
 */

/**
 * `GET /properties/admin/list` — every status, agent's own view.
 * @param {Record<string, string | boolean | number | undefined>} filters
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const useAdminPropertiesList = (filters) => {
  const parsed = PropertyAdminListQuerySchema.safeParse(filters ?? {});
  const query = parsed.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['admin-properties', 'list', query],
    queryFn: async () => unwrapList(await api.get('/properties/admin/list', { params: query })),
    enabled: Boolean(query),
  });

  return { ...result, validationError: parsed.success ? null : parsed.error };
};

/**
 * Bounds the `/properties/admin/list` id-lookup fallback below — see its doc
 * comment for why this exists at all.
 */
const ID_LOOKUP_PAGE_LIMIT = 50;
const ID_LOOKUP_MAX_PAGES = 4;

/**
 * Resolves a listing's slug from its id, so the edit route (`:id`, Section 7.1)
 * can load the full `PropertyResponseSchema` record through WP7's
 * `usePropertyDetail(slug)` — the only endpoint that returns it.
 *
 * `/properties/admin/list` has no id filter (Section 5.2 lists none), so this
 * walks its pages looking for a match. Bounded at `ID_LOOKUP_MAX_PAGES` pages
 * of `ID_LOOKUP_PAGE_LIMIT` each: this is a regional listings catalogue in the
 * low hundreds, not one with an unbounded property count, and the current
 * 24-property seed fits on the first page. The properties table already knows
 * the slug of any row it links to and passes it via router state
 * (`PropertyEditPage`), so this fallback only runs on a direct or refreshed
 * visit to the edit URL.
 *
 * @param {string | undefined} id
 * @param {{ enabled?: boolean }} [options] set `enabled: false` when a slug is already known
 * @returns {import('@tanstack/react-query').UseQueryResult<string | null>}
 */
export const useAdminPropertySlugLookup = (id, options = {}) =>
  useQuery({
    queryKey: ['admin-properties', 'slug-lookup', id],
    queryFn: async () => {
      for (let page = 1; page <= ID_LOOKUP_MAX_PAGES; page += 1) {
        const { items, meta } = unwrapList(
          await api.get('/properties/admin/list', {
            params: { page, limit: ID_LOOKUP_PAGE_LIMIT, sort: 'newest' },
          }),
        );
        const found = items.find((item) => item.id === id);
        if (found) return found.slug;
        if (page * ID_LOOKUP_PAGE_LIMIT >= meta.total) break;
      }
      return null;
    },
    enabled: Boolean(id) && options.enabled !== false,
    staleTime: 60 * 1000,
  });

/**
 * `POST /properties` — creates a listing in `DRAFT`.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, object>} payload is a parsed `PropertyCreateSchema`
 */
export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values) => unwrap(await api.post('/properties', values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-properties', 'list'] });
    },
  });
};

/**
 * `PATCH /properties/:id`.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { id: string } & object>} payload is a parsed `PropertyUpdateSchema` plus `id`
 */
export const useUpdateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }) => unwrap(await api.patch(`/properties/${id}`, values)),
    onSuccess: (property) => {
      // Narrowest key set: this one listing's detail, plus the admin list it
      // appears in (Section 9.3).
      queryClient.invalidateQueries({ queryKey: ['properties', 'detail', property.slug] });
      queryClient.invalidateQueries({ queryKey: ['admin-properties', 'list'] });
    },
  });
};

/**
 * `POST /properties/:id/publish` — `DRAFT` to `AVAILABLE`.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, string>}
 */
export const usePublishProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(await api.post(`/properties/${id}/publish`)),
    onSuccess: (property) => {
      queryClient.invalidateQueries({ queryKey: ['properties', 'detail', property.slug] });
      queryClient.invalidateQueries({ queryKey: ['admin-properties', 'list'] });
    },
  });
};

/**
 * `DELETE /properties/:id` — admin-only soft delete to `WITHDRAWN`. Gate the
 * control that calls this on `useAuth().isAdmin` — the endpoint itself is the
 * real boundary (Section 5.3).
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, string>}
 */
export const useWithdrawProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(await api.delete(`/properties/${id}`)),
    onSuccess: (property) => {
      queryClient.invalidateQueries({ queryKey: ['properties', 'detail', property.slug] });
      queryClient.invalidateQueries({ queryKey: ['admin-properties', 'list'] });
    },
  });
};
