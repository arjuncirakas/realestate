import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_FILTER_KEYS,
  filtersFromSearchParams,
  searchParamsFromFilters,
} from './catalogue-filters.js';

/**
 * The catalogue's URL is the only place its filter state lives (Section 9.3),
 * so a round trip through it has to reproduce the search that produced it —
 * this is what makes the back button and a shared link behave.
 */
describe('the catalogue filter state <-> query-parameter round trip', () => {
  it('recovers every recognised filter from a URL', () => {
    const params = new URLSearchParams(
      'city=Kollam&type=PLOT&minPrice=3000000&maxPrice=7000000&groupPurchaseOnly=true&sort=priceAsc&page=2&view=map',
    );

    expect(filtersFromSearchParams(params)).toEqual({
      city: 'Kollam',
      type: 'PLOT',
      minPrice: '3000000',
      maxPrice: '7000000',
      groupPurchaseOnly: 'true',
      sort: 'priceAsc',
      page: '2',
      view: 'map',
    });
  });

  it('drops a blank query parameter rather than treating it as an applied filter', () => {
    const params = new URLSearchParams('city=&locality=Kottiyam');
    expect(filtersFromSearchParams(params)).toEqual({ locality: 'Kottiyam' });
  });

  it('ignores a query parameter the catalogue does not recognise', () => {
    const params = new URLSearchParams('utm_source=newsletter&city=Alappuzha');
    expect(filtersFromSearchParams(params)).toEqual({ city: 'Alappuzha' });
  });

  it('serialises a filter state back to the URL that produces it', () => {
    const filters = { city: 'Kollam', minPrice: '3000000', sort: 'priceAsc', page: '2' };
    const params = searchParamsFromFilters(filters);

    expect(params.get('city')).toBe('Kollam');
    expect(params.get('minPrice')).toBe('3000000');
    expect(params.get('sort')).toBe('priceAsc');
    expect(params.get('page')).toBe('2');
    expect(filtersFromSearchParams(params)).toEqual(filters);
  });

  it('omits values at their default so a cleared search is a bare URL', () => {
    const params = searchParamsFromFilters({
      q: '',
      groupPurchaseOnly: false,
      page: '1',
      view: 'grid',
      sort: undefined,
    });

    expect([...params.keys()]).toEqual([]);
  });

  it('keeps a non-default page and a non-grid view', () => {
    const params = searchParamsFromFilters({ page: '3', view: 'map' });
    expect(params.get('page')).toBe('3');
    expect(params.get('view')).toBe('map');
  });

  it('round-trips a full filter set through both directions unchanged', () => {
    const original = {
      q: 'Technopark',
      type: 'PLOT',
      city: 'Thiruvananthapuram',
      locality: 'Kazhakkoottam',
      minPrice: '3000000',
      maxPrice: '9000000',
      minArea: '5',
      maxArea: '20',
      areaUnit: 'CENT',
      groupPurchaseOnly: 'true',
      sort: 'areaDesc',
      page: '2',
      view: 'map',
    };

    const roundTripped = filtersFromSearchParams(searchParamsFromFilters(original));
    expect(roundTripped).toEqual(original);
  });

  it('lists every filter key it round-trips, so a new field is a deliberate addition', () => {
    expect(CATALOGUE_FILTER_KEYS).toEqual([
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
  });
});
