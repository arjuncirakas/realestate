import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context.js';
import { Button, EmptyState } from '@/components/ui/index.js';
import { Link } from 'react-router-dom';
import { ROUTES } from './paths.js';
import { loginPathFor } from './next-path.js';
import { RouteLoading } from './RouteLoading.jsx';

/**
 * Requires one of the given roles.
 *
 * An anonymous visitor is sent to the login page. A signed-in user who lacks the
 * role is *not* redirected — they are shown a plain "no access" panel. Bouncing
 * them somewhere else would leave them guessing why the page they clicked
 * vanished, and this is a decision the UI already knows the answer to.
 *
 * This guard is a convenience, not the security boundary. Every endpoint enforces
 * its own authorisation (Section 5.3); hiding a link never protects data.
 *
 * @param {{ roles: string[], children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export const RequireRole = ({ roles, children }) => {
  const { status, hasRole } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <RouteLoading />;

  if (status !== 'authenticated') {
    return <Navigate to={loginPathFor(location)} replace />;
  }

  if (!hasRole(roles)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <EmptyState
          title="You do not have access to this page"
          instruction="This area is for agency staff. If you think you should have access, ask the office to check your account."
          action={
            <Button as={Link} to={ROUTES.dashboard} variant="secondary">
              Go to your dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return children ?? <Outlet />;
};
