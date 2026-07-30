import { CalendarCheck, LayoutGrid, Mail, Map, UserCog, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context.js';
import { ROUTES } from '@/routes/paths.js';
import { SidebarShell } from './SidebarShell.jsx';

const AGENT_NAV = [
  { to: ROUTES.admin, label: 'Overview', icon: LayoutGrid, end: true },
  { to: ROUTES.adminProperties, label: 'Listings', icon: Map },
  { to: ROUTES.adminEnquiries, label: 'Enquiries', icon: Mail },
  { to: ROUTES.adminVisits, label: 'Site visits', icon: CalendarCheck },
  { to: ROUTES.adminInterests, label: 'Interest register', icon: Users },
];

const ADMIN_ONLY_NAV = [{ to: ROUTES.adminUsers, label: 'Users', icon: UserCog }];

/**
 * Agent and admin panel chrome.
 *
 * The Users link is hidden from an agent, but that is tidiness rather than
 * security — `/admin/users` is guarded by `RequireRole` and every endpoint behind
 * it enforces the admin role itself (Section 5.3).
 *
 * @returns {import('react').ReactElement}
 */
export const AdminShell = () => {
  const { isAdmin } = useAuth();
  const navItems = isAdmin ? [...AGENT_NAV, ...ADMIN_ONLY_NAV] : AGENT_NAV;

  return <SidebarShell areaLabel="Agency panel" navItems={navItems} />;
};
