import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserRole } from '@/contracts/index.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import { RequireAuth } from './RequireAuth.jsx';
import { RequireRole } from './RequireRole.jsx';

/**
 * Builds a session value for the guards to read. The provider is bypassed so a
 * guard can be tested at a specific session state without a network call.
 *
 * @param {{ status: string, role?: string }} args
 * @returns {object}
 */
const session = ({ status, role }) => ({
  user: role ? { id: 'u1', fullName: 'Meera Krishnan', email: 'meera@example.test', role } : null,
  status,
  isAuthenticated: status === 'authenticated',
  login: async () => ({}),
  register: async () => ({}),
  logout: async () => undefined,
  refresh: async () => null,
  hasRole: (roles) => Boolean(role && roles.includes(role)),
  isAgent: role === UserRole.AGENT || role === UserRole.ADMIN,
  isAdmin: role === UserRole.ADMIN,
});

/**
 * Renders a guarded route at `/dashboard/saved`, with a stand-in login page so a
 * redirect is observable.
 *
 * @param {{ value: object, guard: import('react').ReactElement }} args
 * @returns {void}
 */
const renderGuarded = ({ value, guard }) =>
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/dashboard/saved']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={guard}>
            <Route path="/dashboard/saved" element={<p>Saved plots</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

/** Reports the `next` parameter it was sent, so the redirect can be asserted. */
function LoginProbe() {
  const next = new URLSearchParams(window.location.search).get('next');
  return <p>Sign in page next={next ?? 'none'}</p>;
}

describe('RequireAuth', () => {
  it('renders the page for a signed-in user', () => {
    renderGuarded({ value: session({ status: 'authenticated', role: UserRole.SUBSCRIBER }), guard: <RequireAuth /> });
    expect(screen.getByText('Saved plots')).toBeInTheDocument();
  });

  it('redirects an anonymous visitor to the login page', () => {
    renderGuarded({ value: session({ status: 'anonymous' }), guard: <RequireAuth /> });
    expect(screen.getByText(/Sign in page/)).toBeInTheDocument();
    expect(screen.queryByText('Saved plots')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is still being checked', () => {
    // The regression this guards: redirecting during `checking` throws a
    // signed-in user out to /login on every hard refresh, before the silent
    // refresh has come back.
    renderGuarded({ value: session({ status: 'checking' }), guard: <RequireAuth /> });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText(/Sign in page/)).not.toBeInTheDocument();
    expect(screen.queryByText('Saved plots')).not.toBeInTheDocument();
  });
});

describe('RequireRole', () => {
  const agentGuard = <RequireRole roles={[UserRole.AGENT, UserRole.ADMIN]} />;

  it('renders the page for a matching role', () => {
    renderGuarded({ value: session({ status: 'authenticated', role: UserRole.AGENT }), guard: agentGuard });
    expect(screen.getByText('Saved plots')).toBeInTheDocument();
  });

  it('renders the page for an admin when agents are allowed', () => {
    renderGuarded({ value: session({ status: 'authenticated', role: UserRole.ADMIN }), guard: agentGuard });
    expect(screen.getByText('Saved plots')).toBeInTheDocument();
  });

  it('shows a no-access panel rather than redirecting a signed-in subscriber', () => {
    renderGuarded({ value: session({ status: 'authenticated', role: UserRole.SUBSCRIBER }), guard: agentGuard });
    expect(screen.getByText('You do not have access to this page')).toBeInTheDocument();
    expect(screen.queryByText(/Sign in page/)).not.toBeInTheDocument();
    expect(screen.queryByText('Saved plots')).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to the login page', () => {
    renderGuarded({ value: session({ status: 'anonymous' }), guard: agentGuard });
    expect(screen.getByText(/Sign in page/)).toBeInTheDocument();
  });

  it('waits while the session is being checked', () => {
    renderGuarded({ value: session({ status: 'checking' }), guard: agentGuard });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('does not admit a subscriber to an admin-only route', () => {
    renderGuarded({
      value: session({ status: 'authenticated', role: UserRole.AGENT }),
      guard: <RequireRole roles={[UserRole.ADMIN]} />,
    });
    expect(screen.getByText('You do not have access to this page')).toBeInTheDocument();
  });
});
