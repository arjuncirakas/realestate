/**
 * Every route path in one place (Section 7.1).
 *
 * Features link through these rather than writing string literals, so renaming a
 * route is one edit instead of a grep across ten feature folders.
 */
export const ROUTES = Object.freeze({
  home: '/',
  properties: '/properties',
  propertyDetail: '/properties/:slug',
  groupPurchase: '/group-purchase',
  groupPurchaseDetail: '/group-purchase/:slug',
  login: '/login',
  register: '/register',

  dashboard: '/dashboard',
  saved: '/dashboard/saved',
  enquiries: '/dashboard/enquiries',
  visits: '/dashboard/visits',
  interests: '/dashboard/interests',
  myProperties: '/dashboard/my-properties',
  myPropertyDetail: '/dashboard/my-properties/:id',

  admin: '/admin',
  adminProperties: '/admin/properties',
  adminPropertyNew: '/admin/properties/new',
  adminPropertyEdit: '/admin/properties/:id/edit',
  adminEnquiries: '/admin/enquiries',
  adminVisits: '/admin/visits',
  adminInterests: '/admin/interests',
  adminUsers: '/admin/users',

  /** Dev-only primitive gallery, not mounted in a production build. */
  designSystem: '/design-system',
});

/**
 * Fills the params of a path template.
 *
 *   buildPath(ROUTES.propertyDetail, { slug: 'varkala-cliffside-8-cent' })
 *   // '/properties/varkala-cliffside-8-cent'
 *
 * @param {string} template a value from `ROUTES` containing `:param` segments
 * @param {Record<string, string>} params
 * @returns {string}
 */
export const buildPath = (template, params = {}) =>
  Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    template,
  );
