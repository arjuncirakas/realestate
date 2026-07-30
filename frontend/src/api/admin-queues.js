import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EnquiryListQuerySchema,
  InterestListQuerySchema,
  SiteVisitListQuerySchema,
} from '@/contracts/index.js';
import { api, unwrap, unwrapList } from './client.js';

/**
 * The agent-facing enquiry, site-visit and interest queues (Section 5.2:
 * `/enquiries`, `/site-visits`, `/interests`). Separate from `@/api/enquiries.js`,
 * `visits.js` and `interests.js` — those are WP8's `/me/*` hooks for a
 * subscriber's own records, which omit `agentNotes` and the assignment fields
 * these rows carry (Section 5.3: "own records" is not the same as staff
 * annotations about them).
 */

// --- Enquiries ---------------------------------------------------------------

/**
 * `GET /enquiries`.
 * @param {{ page?: number, limit?: number, status?: string, propertyId?: string, assignedAgentId?: string, q?: string }} [filters]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const useAdminEnquiries = (filters) => {
  const parsed = EnquiryListQuerySchema.safeParse(filters ?? {});
  const query = parsed.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['admin-enquiries', 'list', query],
    queryFn: async () => unwrapList(await api.get('/enquiries', { params: query })),
    enabled: Boolean(query),
  });

  return { ...result, validationError: parsed.success ? null : parsed.error };
};

/**
 * `PATCH /enquiries/:id` — agent triage: status, assignment, notes.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { id: string, patch: object }>} `patch` is a parsed `EnquiryUpdateSchema`
 */
export const useUpdateEnquiry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => unwrap(await api.patch(`/enquiries/${id}`, patch)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-enquiries', 'list'] });
    },
  });
};

// --- Site visits ---------------------------------------------------------------

/**
 * `GET /site-visits`.
 * @param {{ page?: number, limit?: number, status?: string, propertyId?: string, from?: string, to?: string }} [filters]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const useAdminSiteVisits = (filters) => {
  const parsed = SiteVisitListQuerySchema.safeParse(filters ?? {});
  const query = parsed.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['admin-visits', 'list', query],
    queryFn: async () => unwrapList(await api.get('/site-visits', { params: query })),
    enabled: Boolean(query),
  });

  return { ...result, validationError: parsed.success ? null : parsed.error };
};

/**
 * `PATCH /site-visits/:id` — agent confirms, completes or annotates.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { id: string, patch: object }>} `patch` is a parsed `SiteVisitUpdateSchema`
 */
export const useUpdateSiteVisit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => unwrap(await api.patch(`/site-visits/${id}`, patch)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-visits', 'list'] });
    },
  });
};

// --- Interest registrations ---------------------------------------------------

/**
 * `GET /interests` — the group-purchase follow-up queue. This is an
 * expression-of-interest register only (Section 1.3); it never carries a
 * return, yield or commitment figure.
 * @param {{ page?: number, limit?: number, status?: string, propertyId?: string }} [filters]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }> & { validationError: import('zod').ZodError | null }}
 */
export const useAdminInterests = (filters) => {
  const parsed = InterestListQuerySchema.safeParse(filters ?? {});
  const query = parsed.success ? parsed.data : null;

  const result = useQuery({
    queryKey: ['admin-interests', 'list', query],
    queryFn: async () => unwrapList(await api.get('/interests', { params: query })),
    enabled: Boolean(query),
  });

  return { ...result, validationError: parsed.success ? null : parsed.error };
};

/**
 * `PATCH /interests/:id` — agent follow-up: status, notes.
 * @returns {import('@tanstack/react-query').UseMutationResult<object, Error, { id: string, patch: object }>} `patch` is a parsed `InterestUpdateSchema`
 */
export const useUpdateInterest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) => unwrap(await api.patch(`/interests/${id}`, patch)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interests', 'list'] });
    },
  });
};
