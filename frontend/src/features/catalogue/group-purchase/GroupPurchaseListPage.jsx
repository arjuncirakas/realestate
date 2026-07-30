import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination, Select } from '@/components/ui/index.js';
import { PropertyGrid } from '@/components/property/index.js';
import { usePropertiesList } from '@/api/properties.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'areaDesc', label: 'Area: largest first' },
];

/**
 * Reads `sort` and `page` out of the URL, forcing `groupPurchaseOnly` on
 * regardless of what is there — this page has exactly one filter, and it is
 * not one a visitor can turn off.
 * @param {URLSearchParams} searchParams
 * @returns {{ groupPurchaseOnly: 'true', sort: string | undefined, page: string | undefined }}
 */
const filtersFromSearchParams = (searchParams) => ({
  groupPurchaseOnly: 'true',
  sort: searchParams.get('sort') || undefined,
  page: searchParams.get('page') || undefined,
});

/**
 * `/group-purchase` — every plot flagged `isGroupPurchase`, via the shared
 * catalogue endpoint's `groupPurchaseOnly` filter (Section 7.1). There is no
 * dedicated group-purchase endpoint.
 *
 * This is a register of enquiry opportunities, not a fundraising page
 * (Section 1.3): the count on the list is "N opportunities on record", never
 * a total raised or a spots-remaining figure, and there is no progress
 * device of any kind on a card here — `PropertyCard` already renders each
 * plot's price and identity strip plainly, which is all this page adds to.
 *
 * @returns {import('react').ReactElement}
 */
export default function GroupPurchaseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const listResult = usePropertiesList(filters);

  const setSort = (event) => {
    const next = new URLSearchParams(searchParams);
    if (event.target.value === 'newest') next.delete('sort');
    else next.set('sort', event.target.value);
    next.delete('page');
    setSearchParams(next);
  };

  const setPage = (page) => {
    const next = new URLSearchParams(searchParams);
    if (String(page) === '1') next.delete('page');
    else next.set('page', String(page));
    setSearchParams(next);
  };

  const total = listResult.data?.meta.total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold text-ink">Group purchase opportunities</h1>
        <p className="mt-2 text-sm text-ink-muted">
          A short list of larger plots where several buyers can register interest together.
          Registering interest is an enquiry, not a payment or a commitment — the agency
          contacts you to discuss next steps.
        </p>
        {typeof total === 'number' && (
          <p className="mt-2 text-sm text-ink-muted">
            {total} opportunit{total === 1 ? 'y' : 'ies'} on record
          </p>
        )}
      </header>

      <div className="mb-4 flex justify-end">
        <Select
          label="Sort by"
          className="w-56"
          options={SORT_OPTIONS}
          value={filters.sort ?? 'newest'}
          onChange={setSort}
        />
      </div>

      <PropertyGrid
        result={listResult}
        emptyTitle="No group purchase opportunities right now"
        emptyInstruction="Check back later, or browse the full catalogue to enquire about a plot individually."
      />

      {listResult.data && listResult.data.meta.totalPages > 1 && (
        <Pagination meta={listResult.data.meta} onPageChange={setPage} className="mt-6" />
      )}
    </div>
  );
}
