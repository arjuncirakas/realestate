import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Enquiries (Section 5.2: `POST /properties/:id/enquiries`, `GET /me/enquiries`).
 */

/**
 * `GET /me/enquiries`.
 * @param {{ page?: number, limit?: number, status?: string, propertyId?: string }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useMyEnquiries = (params = {}) => {
  const query = { page: 1, limit: 20, ...params };
  return useQuery({
    queryKey: ['enquiries', 'list', query],
    queryFn: async () => unwrapList(await api.get('/me/enquiries', { params: query })),
  });
};

/**
 * `POST /properties/:id/enquiries` — public and rate-limited (Section 6), so
 * `EnquiryForm` can call this whether or not the visitor is signed in. The
 * property id travels in the mutation payload rather than as a hook argument
 * so one instance can be reused across different plots.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { propertyId: string, name: string, email: string, phone?: string, message: string }>}
 */
export const useCreateEnquiry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, ...values }) =>
      unwrap(await api.post(`/properties/${propertyId}/enquiries`, values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries', 'list'] });
    },
  });
};
