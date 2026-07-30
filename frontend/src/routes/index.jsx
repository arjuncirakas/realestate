import { Route, Routes } from 'react-router-dom';
import { AdminShell, DashboardShell, PublicShell } from '@/components/layout/index.js';
import { UserRole } from '@/contracts/index.js';
import { ROUTES } from './paths.js';
import { RequireAuth } from './RequireAuth.jsx';
import { RequireRole } from './RequireRole.jsx';
import { NotFound } from './Placeholder.jsx';

// --- feature page imports ---------------------------------------------------
// Section 13.1: exactly one import line per feature, added by that feature's
// work package, replacing the matching Placeholder below. Nothing else here.
import DesignSystem from './DesignSystem.jsx';
import LandingPage from '@/features/catalogue/LandingPage.jsx';
import CataloguePage from '@/features/catalogue/CataloguePage.jsx';
import PropertyDetailPage from '@/features/catalogue/PropertyDetailPage.jsx';
import GroupPurchaseListPage from '@/features/catalogue/group-purchase/GroupPurchaseListPage.jsx';
import GroupPurchaseDetailPage from '@/features/catalogue/group-purchase/GroupPurchaseDetailPage.jsx';
import LoginPage from '@/features/auth/pages/LoginPage.jsx';
import RegisterPage from '@/features/auth/pages/RegisterPage.jsx';
import { DashboardOverviewPage, EnquiriesPage, InterestsPage, SavedPlotsPage, VisitsPage } from '@/features/subscriber/pages/index.js';
import { MyPropertiesPage, PropertyRecordPage } from '@/features/owner/pages/index.js';
import {
  AdminEnquiriesPage,
  AdminInterestsPage,
  AdminOverviewPage,
  AdminPropertiesPage,
  AdminUsersPage,
  AdminVisitsPage,
  PropertyCreatePage,
  PropertyEditPage,
} from '@/features/admin/pages/index.js';
// ---------------------------------------------------------------------------

/**
 * The route table from Section 7.1.
 *
 * Structure: a layout route supplies the shell, a guard route supplies access
 * control, and the leaf routes are the pages. Access rules therefore live once per
 * group rather than once per page, so a new admin page cannot be added without a
 * role check — it inherits one by position.
 *
 * @returns {import('react').ReactElement}
 */
export const AppRoutes = () => (
  <Routes>
    {/* Public site */}
    <Route element={<PublicShell />}>
      <Route index element={<LandingPage />} />
      <Route path={ROUTES.properties} element={<CataloguePage />} />
      <Route path={ROUTES.propertyDetail} element={<PropertyDetailPage />} />
      <Route path={ROUTES.groupPurchase} element={<GroupPurchaseListPage />} />
      <Route path={ROUTES.groupPurchaseDetail} element={<GroupPurchaseDetailPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.register} element={<RegisterPage />} />

      {/* Dev-only gallery of the primitives. Tree-shaken out of a production build. */}
      {import.meta.env.DEV && (
        <Route path={ROUTES.designSystem} element={<DesignSystem />} />
      )}

      <Route path="*" element={<NotFound />} />
    </Route>

    {/* Subscriber area — any signed-in user */}
    <Route element={<RequireAuth />}>
      <Route element={<DashboardShell />}>
        <Route path={ROUTES.dashboard} element={<DashboardOverviewPage />} />
        <Route path={ROUTES.saved} element={<SavedPlotsPage />} />
        <Route path={ROUTES.enquiries} element={<EnquiriesPage />} />
        <Route path={ROUTES.visits} element={<VisitsPage />} />
        <Route path={ROUTES.interests} element={<InterestsPage />} />
        <Route path={ROUTES.myProperties} element={<MyPropertiesPage />} />
        <Route path={ROUTES.myPropertyDetail} element={<PropertyRecordPage />} />
      </Route>
    </Route>

    {/* Agency panel — agents and admins */}
    <Route element={<RequireRole roles={[UserRole.AGENT, UserRole.ADMIN]} />}>
      <Route element={<AdminShell />}>
        <Route path={ROUTES.admin} element={<AdminOverviewPage />} />
        <Route path={ROUTES.adminProperties} element={<AdminPropertiesPage />} />
        <Route path={ROUTES.adminPropertyNew} element={<PropertyCreatePage />} />
        <Route path={ROUTES.adminPropertyEdit} element={<PropertyEditPage />} />
        <Route path={ROUTES.adminEnquiries} element={<AdminEnquiriesPage />} />
        <Route path={ROUTES.adminVisits} element={<AdminVisitsPage />} />
        <Route path={ROUTES.adminInterests} element={<AdminInterestsPage />} />

        {/* Admin only, nested so it inherits the agent guard as well */}
        <Route element={<RequireRole roles={[UserRole.ADMIN]} />}>
          <Route path={ROUTES.adminUsers} element={<AdminUsersPage />} />
        </Route>
      </Route>
    </Route>
  </Routes>
);
