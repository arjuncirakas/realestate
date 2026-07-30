import { createContext, useContext } from 'react';

/**
 * The session context and its hook.
 *
 * Separate from `AuthContext.jsx` because that file exports a component, and a
 * file mixing a component with other exports loses fast refresh. The provider
 * lives there; the context object and the hook live here.
 *
 * @typedef {object} AuthValue
 * @property {object | null} user the signed-in user, or null
 * @property {'checking' | 'authenticated' | 'anonymous'} status
 * @property {boolean} isAuthenticated
 * @property {(credentials: { email: string, password: string }) => Promise<object>} login
 * @property {(details: { email: string, password: string, fullName: string, phone?: string }) => Promise<object>} register
 * @property {() => Promise<void>} logout
 * @property {() => Promise<object | null>} refresh
 * @property {(roles: string[]) => boolean} hasRole
 * @property {boolean} isAgent
 * @property {boolean} isAdmin
 */

/** @type {import('react').Context<AuthValue | null>} */
export const AuthContext = createContext(null);

/**
 * Reads the session.
 *
 * Check `status` rather than `isAuthenticated` when the answer matters before the
 * first refresh resolves — `checking` and `anonymous` are different states.
 *
 * @returns {AuthValue}
 * @throws {Error} when used outside `<AuthProvider>`, which is a wiring bug
 */
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
};
