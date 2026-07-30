/**
 * Barrel so `routes/index.jsx` needs only one import line for the whole
 * admin work package (Section 13.1). Each page below is still its own
 * default export (Section 9.1) — this file just re-exports them by name.
 */
export { default as AdminEnquiriesPage } from './AdminEnquiriesPage.jsx';
export { default as AdminInterestsPage } from './AdminInterestsPage.jsx';
export { default as AdminOverviewPage } from './AdminOverviewPage.jsx';
export { default as AdminPropertiesPage } from './AdminPropertiesPage.jsx';
export { default as AdminUsersPage } from './AdminUsersPage.jsx';
export { default as AdminVisitsPage } from './AdminVisitsPage.jsx';
export { default as PropertyCreatePage } from './PropertyCreatePage.jsx';
export { default as PropertyEditPage } from './PropertyEditPage.jsx';
