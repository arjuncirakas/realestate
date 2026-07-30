import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Saved plots (Section 5.2: `/me/saved`). A subscriber's own bookmark list —
 * `SavedPlotsPage` reads it, and any "Save plot" control elsewhere in the app
 * (a catalogue card, a detail page) uses the two mutations below.
 */

/**
 * `GET /me/saved`.
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useSavedPlots = (params = {}) => {
  const query = { page: 1, limit: 20, ...params };
  return useQuery({
    queryKey: ['saved', 'list', query],
    queryFn: async () => unwrapList(await api.get('/me/saved', { params: query })),
  });
};

/**
 * `POST /me/saved/:propertyId` — idempotent, so calling it on an already-saved
 * plot is not an error.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, string>}
 */
export const useSavePlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId) => unwrap(await api.post(`/me/saved/${propertyId}`)),
    onSuccess: () => {
      // Narrowest key that covers every saved-list variant (Section 9.3).
      queryClient.invalidateQueries({ queryKey: ['saved', 'list'] });
    },
  });
};

/**
 * `DELETE /me/saved/:propertyId`.
 * @returns {import('@tanstack/react-query').UseMutationResult<void, Error, string>}
 */
export const useUnsavePlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId) => {
      await api.delete(`/me/saved/${propertyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved', 'list'] });
    },
  });
};
