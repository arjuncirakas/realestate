import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserListQuerySchema } from '@/contracts/index.js';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Admin user management (Section 5.2: `/users`). Both endpoints are
 * admin-only server-side; the page that uses these hooks is additionally
 * nested inside an admin-only `RequireRole` (Section 7.1), so an agent never
 * reaches this file's caller at all.
 */

/**
 * `GET /users`.
 * @param {{ page?: number, limit?: number, q?: string, role?: string, isActive?: boolean | string }} [filters]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const useUsersList = (filters) => {
  const parsed = UserListQuerySchema.safeParse(filters ?? {});
  const query = parsed.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['users', 'list', query],
    queryFn: async () => unwrapList(await api.get('/users', { params: query })),
    enabled: Boolean(query),
  });

  return { ...result, validationError: parsed.success ? null : parsed.error };
};

/**
 * `PATCH /users/:id` — role and activation.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { id: string, patch: object }>} `patch` is a parsed `AdminUserUpdateSchema`
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => unwrap(await api.patch(`/users/${id}`, patch)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
};
