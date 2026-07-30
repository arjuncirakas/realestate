import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Button } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { ROUTES } from '@/routes/paths.js';
import { SkipLink } from './SkipLink.jsx';
import { Wordmark } from './Wordmark.jsx';

/**
 * Shared chrome for the two signed-in areas.
 *
 * `DashboardShell` and `AdminShell` differ only in their nav items and heading, so
 * they compose this rather than each maintaining a copy of the responsive
 * behaviour — which is where two sidebars drift apart.
 *
 * Below `md` the sidebar becomes a horizontally scrolling strip under the header.
 * A drawer would need a focus trap and a close affordance; a scrolling strip keeps
 * every destination reachable in one tap at 360px.
 *
 * @param {object} props
 * @param {string} props.areaLabel names the area, e.g. "Your account"
 * @param {Array<{ to: string, label: string, icon: import('react').ElementType, end?: boolean }>} props.navItems
 * @returns {import('react').ReactElement}
 */
export const SidebarShell = ({ areaLabel, navItems }) => {
  const { user, logout } = useAuth();

  const linkClasses = ({ isActive }) =>
    cn(
      'flex items-center gap-2.5 whitespace-nowrap rounded-card px-3 py-2 text-sm',
      isActive
        ? 'bg-moss/10 text-moss-dark border border-moss/30'
        : 'border border-transparent text-ink-muted hover:bg-parchment hover:text-ink',
    );

  return (
    <>
      <SkipLink />

      <header className="border-b border-hairline bg-parchment">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Wordmark />
            <span className="hidden text-sm text-ink-muted sm:inline">{areaLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-ink-muted md:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} iconLeft={<LogOut className="size-4" />}>
              Sign out
            </Button>
          </div>
        </div>

        {/* Mobile nav strip. */}
        <nav
          className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-2 md:hidden"
          aria-label={areaLabel}
        >
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClasses}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <nav
          className="hidden w-56 shrink-0 flex-col gap-1 md:flex"
          aria-label={areaLabel}
        >
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClasses}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}

          <Link
            to={ROUTES.properties}
            className="mt-3 border-t border-hairline px-3 pt-3 text-sm text-ink-muted hover:text-ink"
          >
            Back to the catalogue
          </Link>
        </nav>

        {/* min-w-0 stops a wide table from forcing the whole page to scroll. */}
        <main id="main-content" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </>
  );
};
