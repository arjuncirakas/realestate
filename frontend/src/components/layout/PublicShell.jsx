import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Button } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { ROUTES } from '@/routes/paths.js';
import { SkipLink } from './SkipLink.jsx';
import { Wordmark } from './Wordmark.jsx';

const PUBLIC_NAV = [
  { to: ROUTES.properties, label: 'Plots' },
  { to: ROUTES.groupPurchase, label: 'Group purchase' },
];

/**
 * @param {{ to: string, label: string, onNavigate?: () => void }} props
 * @returns {import('react').ReactElement}
 */
const HeaderLink = ({ to, label, onNavigate }) => (
  <NavLink
    to={to}
    onClick={onNavigate}
    className={({ isActive }) =>
      cn(
        'rounded-card px-2 py-1.5 text-sm',
        isActive ? 'text-ink underline decoration-moss decoration-2 underline-offset-6' : 'text-ink-muted hover:text-ink',
      )
    }
  >
    {label}
  </NavLink>
);

/**
 * Public site chrome: header, footer, and an `<Outlet />` for the page.
 *
 * The mobile menu is a disclosure rather than an overlay so it needs no focus
 * trap and cannot strand a keyboard user.
 *
 * @returns {import('react').ReactElement}
 */
export const PublicShell = () => {
  const { isAuthenticated, isAgent, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <SkipLink />

      <header className="sticky top-0 z-30 border-b border-hairline bg-parchment/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Wordmark />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {PUBLIC_NAV.map((item) => (
              <HeaderLink key={item.to} {...item} />
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated ? (
              <>
                {isAgent && (
                  <Button as={Link} to={ROUTES.admin} variant="ghost" size="sm">
                    Agent panel
                  </Button>
                )}
                <Button as={Link} to={ROUTES.dashboard} variant="secondary" size="sm">
                  {user?.fullName?.split(' ')[0] ?? 'Dashboard'}
                </Button>
              </>
            ) : (
              <>
                <Button as={Link} to={ROUTES.login} variant="ghost" size="sm">
                  Sign in
                </Button>
                <Button as={Link} to={ROUTES.register} size="sm">
                  Create account
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex items-center rounded-card border border-hairline bg-surface p-2 text-ink md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-nav"
            className="border-t border-hairline bg-surface px-4 py-3 md:hidden"
            aria-label="Main"
          >
            <div className="flex flex-col gap-1">
              {PUBLIC_NAV.map((item) => (
                <HeaderLink key={item.to} {...item} onNavigate={closeMenu} />
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
              {isAuthenticated ? (
                <>
                  {isAgent && (
                    <Button as={Link} to={ROUTES.admin} variant="secondary" size="sm" onClick={closeMenu} fullWidth>
                      Agent panel
                    </Button>
                  )}
                  <Button as={Link} to={ROUTES.dashboard} size="sm" onClick={closeMenu} fullWidth>
                    Your dashboard
                  </Button>
                </>
              ) : (
                <>
                  <Button as={Link} to={ROUTES.login} variant="secondary" size="sm" onClick={closeMenu} fullWidth>
                    Sign in
                  </Button>
                  <Button as={Link} to={ROUTES.register} size="sm" onClick={closeMenu} fullWidth>
                    Create account
                  </Button>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-hairline bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2">
          <div>
            <Wordmark />
            <p className="mt-2 max-w-prose text-sm text-ink-muted">
              Land and plot records for Thiruvananthapuram, Kollam and Alappuzha. Every listing
              carries its survey number and measured area so you can check it against your own
              paperwork.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-1.5 sm:items-end">
            <Link to={ROUTES.properties} className="text-sm text-ink-muted hover:text-ink">
              Browse plots
            </Link>
            <Link to={ROUTES.groupPurchase} className="text-sm text-ink-muted hover:text-ink">
              Group purchase opportunities
            </Link>
          </nav>
        </div>

        <div className="border-t border-hairline px-4 py-4">
          {/*
            Section 1.3: the group-purchase register records interest only. Saying
            so in the footer means it is stated on every page of the flow, not just
            on the form.
          */}
          <p className="mx-auto max-w-6xl text-xs text-ink-muted">
            Group purchase entries record an expression of interest only. The agency contacts you
            to discuss next steps, and no payment is ever collected through this site.
          </p>
        </div>
      </footer>
    </>
  );
};
