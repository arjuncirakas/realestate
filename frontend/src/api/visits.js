import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Site visits (Section 5.2: `POST /properties/:id/site-visits`,
 * `GET /me/site-visits`, `PATCH /me/site-visits/:id/cancel`).
 */

/**
 * `GET /me/site-visits`.
 * @param {{ page?: number, limit?: number, status?: string, propertyId?: string, from?: string, to?: string }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useMySiteVisits = (params = {}) => {
  const query = { page: 1, limit: 20, ...params };
  return useQuery({
    queryKey: ['visits', 'list', query],
    queryFn: async () => unwrapList(await api.get('/me/site-visits', { params: query })),
  });
};

/**
 * `POST /properties/:id/site-visits` — authenticated. The property id travels
 * in the mutation payload so one instance can be reused across different plots.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { propertyId: string, preferredDate: string, preferredSlot: string, contactPhone?: string }>}
 */
export const useRequestSiteVisit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, ...values }) =>
      unwrap(await api.post(`/properties/${propertyId}/site-visits`, values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'list'] });
    },
  });
};

/**
 * `PATCH /me/site-visits/:id/cancel` — own visits only.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, string>}
 */
export const useCancelSiteVisit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(await api.patch(`/me/site-visits/${id}/cancel`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'list'] });
    },
  });
};
