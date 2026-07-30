/**
 * Validates the `?next=` value used to return a user to where they were headed
 * after signing in (Section 7.1).
 *
 * This is an open-redirect surface: whatever ends up here is handed to
 * `navigate()`, so an attacker who gets a victim to open
 * `/login?next=//evil.example` would have the app itself bounce them off-site
 * after a genuine login, with the trust that implies.
 *
 * It matters more than usual on this project because the pinned react-router 6.x
 * carries an advisory for exactly this class of bug — backslash handling in
 * `Link`/`useNavigate`, GHSA-wrjc-x8rr-h8h6 — with no fix inside the v6 line.
 * Rejecting the input here does not depend on the router behaving.
 *
 * Only a plain same-origin path is accepted; anything else falls back.
 */

/** Control characters, which browsers may strip before resolving a URL. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * @param {unknown} raw the raw `next` query parameter
 * @param {string} [fallback] where to go when `raw` is unusable
 * @returns {string} a safe path to navigate to
 */
export const safeNextPath = (raw, fallback = '/dashboard') => {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;

  // A backslash is a path separator to some parsers and a literal to others;
  // `/\evil.example` is the documented bypass. Reject outright.
  if (raw.includes('\\')) return fallback;

  // Must be a rooted path — not an absolute URL, not scheme-relative.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;

  if (CONTROL_CHARACTERS.test(raw)) return fallback;

  return raw;
};

/**
 * Builds the login URL that will return the user to `location` afterwards.
 * @param {{ pathname: string, search?: string }} location
 * @returns {string}
 */
export const loginPathFor = (location) => {
  const target = `${location.pathname}${location.search ?? ''}`;
  return `/login?next=${encodeURIComponent(target)}`;
};
