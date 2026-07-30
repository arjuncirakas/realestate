/**
 * The catalogue filter state ↔ URL search-param round trip.
 *
 * Every value crosses the URL as a plain string — the same shape a browser
 * gives `URLSearchParams` and the same shape `PropertyListQuerySchema`
 * expects from a query string — so a shared or bookmarked link reproduces
 * exactly the search that produced it, without a separate parsing step that
 * could drift from what the API actually accepts.
 */

/** Every key the catalogue page carries in the URL. `view` is UI-only — the
 * query schema strips it, since it never reaches `/properties`. */
export const CATALOGUE_FILTER_KEYS = Object.freeze([
  'q',
  'type',
  'city',
  'locality',
  'minPrice',
  'maxPrice',
  'minArea',
  'maxArea',
  'areaUnit',
  'groupPurchaseOnly',
  'sort',
  'page',
  'view',
]);

/** The state an empty URL represents. */
export const DEFAULT_CATALOGUE_FILTERS = Object.freeze({ view: 'grid' });

/** The subset of {@link CATALOGUE_FILTER_KEYS} the filter sidebar actually edits
 * — everything except `sort`, `page` and `view`, which change from controls
 * outside the form and should not reset it. */
const FORM_FILTER_KEYS = CATALOGUE_FILTER_KEYS.filter(
  (key) => key !== 'sort' && key !== 'page' && key !== 'view',
);

/**
 * A stable string that changes only when a form-relevant filter changes —
 * not when sort, page or the grid/map toggle does. `CataloguePage` uses this
 * as `PropertyFiltersForm`'s `key`, so the form remounts (and its draft
 * resets to the URL) exactly when something outside the form changed what it
 * should show — a back-button navigation or a "Clear filters" click — and at
 * no other time (Section 9.1: React's own answer to resetting state from a
 * prop change, rather than a synchronising effect).
 * @param {Record<string, unknown>} filters
 * @returns {string}
 */
export const formFiltersKey = (filters) =>
  FORM_FILTER_KEYS.map((key) => `${key}=${filters[key] ?? ''}`).join('&');

/**
 * Reads the recognised filter keys out of the URL, dropping anything blank.
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, string>}
 */
export const filtersFromSearchParams = (searchParams) => {
  const filters = {};
  for (const key of CATALOGUE_FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value !== null && value !== '') filters[key] = value;
  }
  return filters;
};

/**
 * Serialises a filter state back into search params, dropping anything
 * blank, falsy, or already at its default — so applying no filters leaves a
 * bare `/properties` URL rather than one padded with empty parameters.
 * @param {Record<string, string | boolean | number | undefined>} filters
 * @returns {URLSearchParams}
 */
export const searchParamsFromFilters = (filters) => {
  const params = new URLSearchParams();
  for (const key of CATALOGUE_FILTER_KEYS) {
    const value = filters[key];
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (key === 'page' && String(value) === '1') continue;
    if (key === 'view' && value === 'grid') continue;
    params.set(key, String(value));
  }
  return params;
};
