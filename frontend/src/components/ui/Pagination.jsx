import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn.js';

/** Gap marker in the page list. */
const GAP = 'gap';

/**
 * Builds the page list: first, last, and a window around the current page, with
 * gaps standing in for the rest. Keeps the control a fixed width whether there
 * are 3 pages or 300.
 *
 * @param {{ page: number, totalPages: number, windowSize?: number }} args
 * @returns {Array<number | 'gap'>}
 */
const buildPageList = ({ page, totalPages, windowSize = 1 }) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages]);
  for (let offset = -windowSize; offset <= windowSize; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) pages.add(candidate);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const withGaps = [];
  for (const [index, value] of sorted.entries()) {
    if (index > 0 && value - sorted[index - 1] > 1) withGaps.push(GAP);
    withGaps.push(value);
  }
  return withGaps;
};

const pageButtonClasses = (isCurrent) =>
  cn(
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-card border px-2 text-sm tabular-nums',
    isCurrent
      ? 'border-moss bg-moss text-parchment'
      : 'border-hairline bg-surface text-ink hover:bg-parchment',
  );

/**
 * Pagination control, driven straight from the `meta` block of a paginated
 * response (Section 5.1).
 *
 * Renders nothing when there is only one page — a lone "1" is noise.
 *
 * @param {object} props
 * @param {{ page: number, limit: number, total: number, totalPages: number }} props.meta
 * @param {(page: number) => void} props.onPageChange
 * @param {string} [props.className] layout classes
 * @returns {import('react').ReactElement | null}
 */
export const Pagination = ({ meta, onPageChange, className }) => {
  if (!meta || meta.totalPages <= 1) return null;

  const { page, limit, total, totalPages } = meta;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
      aria-label="Pagination"
    >
      <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
        Showing {first}–{last} of {total}
      </p>

      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={cn(pageButtonClasses(false), 'disabled:opacity-40')}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </li>

        {buildPageList({ page, totalPages }).map((entry, index) =>
          entry === GAP ? (
            <li
              // Gap positions are stable for a given page list, so the index is
              // a legitimate key here.
              key={`gap-${index}`}
              className="px-1 text-ink-muted"
              aria-hidden="true"
            >
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                onClick={() => onPageChange(entry)}
                className={pageButtonClasses(entry === page)}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={cn(pageButtonClasses(false), 'disabled:opacity-40')}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
};
