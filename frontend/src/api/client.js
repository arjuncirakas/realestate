import axios from 'axios';
import { ErrorEnvelopeSchema } from '@/contracts/index.js';

/**
 * The single configured axios instance. Components never import axios directly —
 * they use a React Query hook from `src/api/` which uses this (Section 9.3).
 *
 * Session model (Section 6):
 * - The access token lives in memory only. Never `localStorage` — a token there
 *   is readable by any injected script and survives the tab.
 * - The refresh token is an `httpOnly` cookie the browser sends automatically,
 *   which is why `withCredentials` is on.
 */

const DEFAULT_BASE_URL = 'http://localhost:4000/api/v1';

/** Client-side only. Not one of the Section 5.1 server codes. */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

/**
 * Paths where a 401 is the answer rather than an expired session.
 *
 * Refreshing after a failed login would be pointless, and refreshing after a
 * failed refresh is how you build an infinite loop.
 */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

/**
 * A bare instance for the refresh call itself, with no interceptors attached.
 * Using `api` here would put the refresh request through the very interceptor
 * that triggers refreshes.
 */
const refreshClient = axios.create({
  baseURL: api.defaults.baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

let accessToken = null;
let sessionExpiredHandler = null;

/**
 * Stores the access token in memory for subsequent requests.
 * @param {string | null} token pass null to clear it
 * @returns {void}
 */
export const setAccessToken = (token) => {
  accessToken = token;
};

/**
 * @returns {string | null} the in-memory access token
 */
export const getAccessToken = () => accessToken;

/**
 * Registers the callback used when refresh fails and the session is over.
 * `AuthContext` sets this so it can clear its own state and redirect.
 * @param {(() => void) | null} handler
 * @returns {void}
 */
export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = handler;
};

/**
 * An API failure, normalised. `message` is always safe to show a user: the
 * backend guarantees its error messages carry no internal detail (Section 5.1),
 * and anything unparseable is replaced with generic text here.
 */
export class ApiError extends Error {
  /**
   * @param {{ code: string, message: string, status: number, details?: Array<{ field: string, message: string }> }} args
   */
  constructor({ code, message, status, details }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.isApiError = true;
  }

  /**
   * The message for a specific field, for a form that did not catch a rule the
   * server enforces.
   * @param {string} field
   * @returns {string | undefined}
   */
  detailFor(field) {
    return this.details?.find((detail) => detail.field === field)?.message;
  }
}

/**
 * Converts an axios error into an `ApiError`.
 * @param {unknown} error
 * @returns {ApiError}
 */
const toApiError = (error) => {
  if (!error?.response) {
    const timedOut = error?.code === 'ECONNABORTED';
    return new ApiError({
      code: NETWORK_ERROR_CODE,
      status: 0,
      message: timedOut
        ? 'That request took too long. Check your connection and try again.'
        : 'Could not reach the server. Check your connection and try again.',
    });
  }

  const { status, data } = error.response;
  // The body should be the Section 5.1 error envelope. It might not be — a proxy
  // or gateway can return HTML — so it is validated rather than trusted.
  const parsed = ErrorEnvelopeSchema.safeParse(data);
  if (parsed.success) {
    return new ApiError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details,
      status,
    });
  }

  return new ApiError({
    code: 'INTERNAL_ERROR',
    status,
    message: 'Something went wrong. Try again shortly.',
  });
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * In-flight refresh, shared so that several requests failing at once trigger one
 * refresh rather than one each.
 * @type {Promise<string> | null}
 */
let refreshInFlight = null;

/**
 * Exchanges the refresh cookie for a new access token.
 *
 * @returns {Promise<{ accessToken: string, user: object }>}
 * @throws {ApiError} when there is no usable session
 */
export const requestRefresh = async () => {
  try {
    const response = await refreshClient.post('/auth/refresh');
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Runs at most one refresh at a time and resolves with the new access token.
 * @returns {Promise<string>}
 */
const refreshOnce = () => {
  refreshInFlight ??= requestRefresh()
    .then((session) => {
      setAccessToken(session.accessToken);
      return session.accessToken;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    const shouldTryRefresh =
      status === 401 &&
      config &&
      // `_hasRetried` is the loop guard: a request is retried once and only once,
      // so a token that is rejected again goes straight to session-expired.
      !config._hasRetried &&
      !NO_REFRESH_PATHS.some((path) => (config.url ?? '').startsWith(path));

    if (!shouldTryRefresh) {
      return Promise.reject(toApiError(error));
    }

    config._hasRetried = true;

    try {
      const token = await refreshOnce();
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
      return await api.request(config);
    } catch {
      setAccessToken(null);
      sessionExpiredHandler?.();
      // Report the original 401, not the refresh failure — the caller asked
      // about its own request.
      return Promise.reject(toApiError(error));
    }
  },
);

/**
 * The `data` payload of a success envelope (Section 5.1).
 * @template T
 * @param {{ data: { data: T } }} response
 * @returns {T}
 */
export const unwrap = (response) => response.data.data;

/**
 * The items and pagination meta of a paginated envelope.
 * @template T
 * @param {{ data: { data: T[], meta: { page: number, limit: number, total: number, totalPages: number } } }} response
 * @returns {{ items: T[], meta: { page: number, limit: number, total: number, totalPages: number } }}
 */
export const unwrapList = (response) => ({
  items: response.data.data,
  meta: response.data.meta,
});
