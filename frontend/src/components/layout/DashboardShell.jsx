import { Bookmark, CalendarCheck, LayoutGrid, Mail, MapPinned, Users } from 'lucide-react';
import { ROUTES } from '@/routes/paths.js';
import { SidebarShell } from './SidebarShell.jsx';

/**
 * Navigation for a subscriber's own records (Section 7.1).
 *
 * "My plots" is listed for everyone rather than gated on a role: ownership is a
 * data relationship, not a role, so whether it has anything in it is answered by
 * the page's empty state.
 */
const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: 'Overview', icon: LayoutGrid, end: true },
  { to: ROUTES.saved, label: 'Saved plots', icon: Bookmark },
  { to: ROUTES.enquiries, label: 'Enquiries', icon: Mail },
  { to: ROUTES.visits, label: 'Site visits', icon: CalendarCheck },
  { to: ROUTES.interests, label: 'Registered interest', icon: Users },
  { to: ROUTES.myProperties, label: 'My plots', icon: MapPinned },
];

/**
 * Subscriber dashboard chrome.
 * @returns {import('react').ReactElement}
 */
export const DashboardShell = () => (
  <SidebarShell areaLabel="Your account" navItems={NAV_ITEMS} />
);
