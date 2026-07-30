import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  requestRefresh,
  setAccessToken,
  setSessionExpiredHandler,
  unwrap,
} from '@/api/client.js';
import { UserRole } from '@/contracts/index.js';
import { AuthContext } from './auth-context.js';

/**
 * Session state for the whole app (Section 6).
 *
 * The access token is held by `api/client.js` in a module variable, not here, so
 * that a React re-render can never be the reason a request goes out unauthorised.
 * This context holds the user and the status a component can render from.
 *
 * `useAuth` lives in ./auth-context.js.
 *
 * `status` is a three-state value on purpose. A boolean `isAuthenticated` cannot
 * distinguish "not signed in" from "we have not checked yet", and route guards
 * that cannot tell those apart bounce a signed-in user to the login page on every
 * hard refresh.
 */

/**
 * Provides session state. Mount it above the router so guards can read it.
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('checking');

  /**
   * Applies a session returned by login, register or refresh.
   * @param {{ accessToken: string, user: object }} session
   * @returns {object} the user
   */
  const applySession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  /**
   * Restores the session from the refresh cookie.
   * @returns {Promise<object | null>} the user, or null when there is no session
   */
  const refresh = useCallback(async () => {
    try {
      return applySession(await requestRefresh());
    } catch {
      clearSession();
      return null;
    }
  }, [applySession, clearSession]);

  // One silent refresh on mount, so a reload keeps the user signed in via the
  // httpOnly cookie. A failure here is the normal case for a visitor, so it
  // resolves to anonymous rather than surfacing an error.
  useEffect(() => {
    let cancelled = false;

    requestRefresh()
      .then((session) => {
        if (!cancelled) applySession(session);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  // When the client exhausts its single retry, the session is over. Registered
  // here so the redirect and the state change happen together.
  useEffect(() => {
    setSessionExpiredHandler(() => clearSession());
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  /**
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<object>} the signed-in user
   */
  const login = useCallback(
    async (credentials) => applySession(unwrap(await api.post('/auth/login', credentials))),
    [applySession],
  );

  /**
   * @param {{ email: string, password: string, fullName: string, phone?: string }} details
   * @returns {Promise<object>} the newly created user
   */
  const register = useCallback(
    async (details) => applySession(unwrap(await api.post('/auth/register', details))),
    [applySession],
  );

  /**
   * Revokes the refresh token and clears local state.
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Local state is cleared even if the call fails — the user asked to be
      // signed out, and the token expires within 15 minutes regardless.
      clearSession();
    }
  }, [clearSession]);

  /**
   * @param {string[]} roles
   * @returns {boolean} whether the current user holds one of them
   */
  const hasRole = useCallback((roles) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      refresh,
      hasRole,
      isAgent: hasRole([UserRole.AGENT, UserRole.ADMIN]),
      isAdmin: hasRole([UserRole.ADMIN]),
    }),
    [user, status, login, register, logout, refresh, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
