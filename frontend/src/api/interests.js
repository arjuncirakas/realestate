import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Group-purchase interest registrations (Section 5.2:
 * `POST /properties/:id/interest`, `GET /me/interests`,
 * `PATCH /me/interests/:id/withdraw`). This is an expression-of-interest
 * register only — Section 1.3 — it never moves money.
 */

/**
 * `GET /me/interests`.
 * @param {{ page?: number, limit?: number, status?: string, propertyId?: string }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useMyInterests = (params = {}) => {
  const query = { page: 1, limit: 20, ...params };
  return useQuery({
    queryKey: ['interests', 'list', query],
    queryFn: async () => unwrapList(await api.get('/me/interests', { params: query })),
  });
};

/**
 * `POST /properties/:id/interest` — registers interest, or reopens a
 * withdrawn registration for the same plot; it only 409s while one is already
 * open. The property id travels in the mutation payload so one instance can
 * be reused across different plots, including re-registering from the
 * interests dashboard after a withdrawal.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { propertyId: string, indicativeAmount?: string, notes?: string }>}
 */
export const useRegisterInterest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, ...values }) =>
      unwrap(await api.post(`/properties/${propertyId}/interest`, values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests', 'list'] });
    },
  });
};

/**
 * `PATCH /me/interests/:id/withdraw` — own registrations only.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, string>}
 */
export const useWithdrawInterest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => unwrap(await api.patch(`/me/interests/${id}/withdraw`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests', 'list'] });
    },
  });
};
