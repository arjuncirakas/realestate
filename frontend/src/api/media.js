import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client.js';

/**
 * Property media (Section 5.2): upload, caption/order/cover edit, delete. All
 * three write into the same `media` array on a property's detail record, so
 * every mutation here invalidates that one entry rather than the wider
 * catalogue (Section 9.3).
 */

/**
 * Invalidates a property's cached detail — every mutation below changes
 * exactly that record's `media` array (and, for a cover change, its
 * `coverImageUrl`, which the admin list also carries).
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string | undefined} slug the property's slug, when the caller has it
 * @returns {void}
 */
const invalidatePropertyMedia = (queryClient, slug) => {
  if (slug) queryClient.invalidateQueries({ queryKey: ['properties', 'detail', slug] });
  queryClient.invalidateQueries({ queryKey: ['admin-properties', 'list'] });
};

/**
 * `POST /properties/:id/media` — multipart, field name `files`, max 10 files
 * at 10 MB each (Section 5.2). The shared `api` instance defaults to a JSON
 * content type, which would make axios stringify a `FormData` body instead of
 * sending it as multipart — clearing the header here lets the browser set
 * `multipart/form-data` itself, boundary included.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult<object[], Error, { propertyId: string, slug?: string, files: File[], caption?: string, sortOrder?: number }>}
 */
export const useUploadMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, files, caption, sortOrder }) => {
      const formData = new FormData();
      for (const file of files) formData.append('files', file);
      if (caption) formData.append('caption', caption);
      if (sortOrder !== undefined) formData.append('sortOrder', String(sortOrder));

      return unwrap(
        await api.post(`/properties/${propertyId}/media`, formData, {
          headers: { 'Content-Type': undefined },
        }),
      );
    },
    onSuccess: (_media, { slug }) => invalidatePropertyMedia(queryClient, slug),
  });
};

/**
 * `PATCH /media/:id` — caption, sort order, or cover flag (Section 5.2).
 * Setting `isCover: true` clears the flag on the property's other media
 * server-side; there is nothing for this hook to do beyond sending the patch.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { id: string, slug?: string, patch: object }>} `patch` is a parsed `MediaUpdateSchema`
 */
export const useUpdateMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => unwrap(await api.patch(`/media/${id}`, patch)),
    onSuccess: (_media, { slug }) => invalidatePropertyMedia(queryClient, slug),
  });
};

/**
 * `DELETE /media/:id` — `204 No Content` (Section 5.2), so there is no body
 * to unwrap.
 * @returns {import('@tanstack/react-query').UseMutationResult<void, Error, { id: string, slug?: string }>}
 */
export const useDeleteMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      await api.delete(`/media/${id}`);
    },
    onSuccess: (_result, { slug }) => invalidatePropertyMedia(queryClient, slug),
  });
};
