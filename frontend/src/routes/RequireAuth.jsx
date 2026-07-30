import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context.js';
import { loginPathFor } from './next-path.js';
import { RouteLoading } from './RouteLoading.jsx';

/**
 * Requires a signed-in user. An anonymous visitor is sent to
 * `/login?next=<path>` and returned afterwards (Section 7.1).
 *
 * Use as a layout route wrapping others, or around a single element:
 *
 *   <Route element={<RequireAuth />}>…</Route>
 *   <RequireAuth><Something /></RequireAuth>
 *
 * While `status` is `checking` it renders a loading state rather than deciding.
 * Redirecting during that window is the classic bug that throws a signed-in user
 * out to the login page on every hard refresh, because the silent refresh has not
 * come back yet.
 *
 * @param {{ children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export const RequireAuth = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <RouteLoading />;

  if (status !== 'authenticated') {
    return <Navigate to={loginPathFor(location)} replace />;
  }

  return children ?? <Outlet />;
};
