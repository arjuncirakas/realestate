import { useQuery } from '@tanstack/react-query';
import { api, unwrap, unwrapList } from './client.js';

/**
 * Ownership records, the agency's management log, and the site photo timeline
 * (Section 5.2: `/me/properties`, `/me/properties/:id`, `/me/properties/:id/logs`,
 * `/me/properties/:id/snapshots`). Read-only from the owner's side — creating and
 * editing these records is an agent action outside this work package.
 */

/**
 * `GET /me/properties` — the plots the signed-in user owns, in whole or in part.
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useMyProperties = (params = {}) => {
  const query = { page: 1, limit: 20, ...params };
  return useQuery({
    queryKey: ['ownership', 'my-properties', query],
    queryFn: async () => unwrapList(await api.get('/me/properties', { params: query })),
  });
};

/**
 * `GET /me/properties/:id` — the property, the caller's own ownership row, and
 * every share on the plot (`ownerships`), so a co-owner can see how the 100%
 * splits.
 * @param {string} propertyId
 * @returns {import('@tanstack/react-query').UseQueryResult<object>}
 */
export const useMyPropertyDetail = (propertyId) =>
  useQuery({
    queryKey: ['ownership', 'detail', propertyId],
    queryFn: async () => unwrap(await api.get(`/me/properties/${propertyId}`)),
    enabled: Boolean(propertyId),
  });

/**
 * `GET /me/properties/:id/logs` — visible management log entries, newest
 * first. There is no `includeHidden` parameter to request: a log with
 * `isVisibleToOwner: false` never reaches this endpoint, for any caller.
 * @param {string} propertyId
 * @param {{ page?: number, limit?: number, logType?: string, from?: string, to?: string }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useMyPropertyLogs = (propertyId, params = {}) => {
  const query = { page: 1, limit: 10, ...params };
  return useQuery({
    queryKey: ['ownership', 'logs', propertyId, query],
    queryFn: async () =>
      unwrapList(await api.get(`/me/properties/${propertyId}/logs`, { params: query })),
    enabled: Boolean(propertyId),
  });
};

/**
 * `GET /me/properties/:id/snapshots` — site photographs, newest first.
 * @param {string} propertyId
 * @param {{ page?: number, limit?: number, from?: string, to?: string }} [params]
 * @returns {import('@tanstack/react-query').UseQueryResult<{ items: object[], meta: object }>}
 */
export const useMyPropertySnapshots = (propertyId, params = {}) => {
  const query = { page: 1, limit: 12, ...params };
  return useQuery({
    queryKey: ['ownership', 'snapshots', propertyId, query],
    queryFn: async () =>
      unwrapList(await api.get(`/me/properties/${propertyId}/snapshots`, { params: query })),
    enabled: Boolean(propertyId),
  });
};
