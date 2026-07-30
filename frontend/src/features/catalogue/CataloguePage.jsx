import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Map as MapIcon } from 'lucide-react';
import { Button, Pagination, Select } from '@/components/ui/index.js';
import { PropertyFiltersForm, PropertyGrid, PropertyMapExplorer } from '@/components/property/index.js';
import { usePropertiesList } from '@/api/properties.js';
import {
  CATALOGUE_FILTER_KEYS,
  filtersFromSearchParams,
  formFiltersKey,
  searchParamsFromFilters,
} from './catalogue-filters.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'areaDesc', label: 'Area: largest first' },
];

/** Everything except `q`/`type`/`city`/`locality`/geo — the small set that survives a "clear filters" click if it came from a link, e.g. the group-purchase filter. */
const isPresentationOnlyKey = (key) => key === 'view';

/**
 * `/properties` — filter sidebar, a grid/map toggle, and pagination
 * (Section 7.1). Filter state, sort, page and the grid/map toggle all live in
 * the URL via {@link filtersFromSearchParams}, so the back button and a
 * shared link both reproduce the exact search a visitor was looking at.
 *
 * @returns {import('react').ReactElement}
 */
export default function CataloguePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const view = filters.view === 'map' ? 'map' : 'grid';

  const listResult = usePropertiesList(filters);

  const applyFilters = (nextFilters) => {
    setSearchParams(searchParamsFromFilters({ ...nextFilters, sort: filters.sort, view }));
  };

  const clearFilters = () => {
    const kept = {};
    for (const key of CATALOGUE_FILTER_KEYS) {
      if (isPresentationOnlyKey(key) && filters[key]) kept[key] = filters[key];
    }
    setSearchParams(searchParamsFromFilters(kept));
  };

  const setSort = (event) => {
    setSearchParams(searchParamsFromFilters({ ...filters, sort: event.target.value, page: undefined }));
  };

  const setPage = (page) => {
    setSearchParams(searchParamsFromFilters({ ...filters, page }));
  };

  const setView = (nextView) => {
    setSearchParams(searchParamsFromFilters({ ...filters, view: nextView }));
  };

  const total = listResult.data?.meta.total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-ink">Plots</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {typeof total === 'number' ? `${total} plot${total === 1 ? '' : 's'} on record` : 'Filter and browse the current listings.'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <PropertyFiltersForm
            key={formFiltersKey(filters)}
            filters={filters}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-card border border-hairline bg-surface p-1"
              role="group"
              aria-label="View"
            >
              <Button
                type="button"
                variant={view === 'grid' ? 'primary' : 'ghost'}
                size="sm"
                iconLeft={<LayoutGrid className="size-4" />}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                Grid
              </Button>
              <Button
                type="button"
                variant={view === 'map' ? 'primary' : 'ghost'}
                size="sm"
                iconLeft={<MapIcon className="size-4" />}
                aria-pressed={view === 'map'}
                onClick={() => setView('map')}
              >
                Map
              </Button>
            </div>

            {view === 'grid' && (
              <Select
                label="Sort by"
                className="w-56 shrink-0"
                options={SORT_OPTIONS}
                value={filters.sort ?? 'newest'}
                onChange={setSort}
              />
            )}
          </div>

          {view === 'grid' ? (
            <>
              <PropertyGrid result={listResult} />
              {listResult.data && listResult.data.meta.totalPages > 1 && (
                <Pagination meta={listResult.data.meta} onPageChange={setPage} className="mt-6" />
              )}
            </>
          ) : (
            <PropertyMapExplorer filters={filters} />
          )}
        </div>
      </div>
    </div>
  );
}
