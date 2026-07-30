/**
 * Barrel so `routes/index.jsx` needs only one import line for the whole
 * subscriber work package (Section 13.1). Each page below is still its own
 * default export (Section 9.1) — this file just re-exports them by name.
 */
export { default as DashboardOverviewPage } from './DashboardOverviewPage.jsx';
export { default as EnquiriesPage } from './EnquiriesPage.jsx';
export { default as InterestsPage } from './InterestsPage.jsx';
export { default as SavedPlotsPage } from './SavedPlotsPage.jsx';
export { default as VisitsPage } from './VisitsPage.jsx';
