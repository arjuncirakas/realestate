import { cn } from '@/lib/cn.js';

/**
 * A loading placeholder.
 *
 * The pulse stops under `prefers-reduced-motion`, handled globally in index.css.
 *
 * @param {object} props
 * @param {string} [props.className] size and layout classes — give it a height
 * @returns {import('react').ReactElement}
 */
export const Skeleton = ({ className }) => (
  <div className={cn('animate-pulse rounded-card bg-hairline', className)} aria-hidden="true" />
);

/**
 * Several lines of placeholder text, the last one short so it reads as prose.
 * @param {object} props
 * @param {number} [props.lines]
 * @param {string} [props.className]
 * @returns {import('react').ReactElement}
 */
export const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton
        key={index}
        className={cn('h-4', index === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

/**
 * The loading state for a list or grid of plot cards.
 *
 * One announcement wraps the whole group: a screen reader should hear "Loading"
 * once, not once per placeholder. Every list needs one of these — a bare spinner
 * is not acceptable (Section 9.3).
 *
 * @param {object} props
 * @param {number} [props.count]
 * @param {string} [props.label] what is loading, e.g. "Loading plots"
 * @param {string} [props.className] grid classes
 * @returns {import('react').ReactElement}
 */
export const SkeletonCardGrid = ({ count = 6, label = 'Loading', className }) => (
  <div
    className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
    role="status"
    aria-label={label}
  >
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="rounded-card border border-hairline bg-surface p-4">
        <Skeleton className="mb-3 aspect-[4/3] w-full" />
        <Skeleton className="mb-2 h-5 w-3/4" />
        <Skeleton className="mb-3 h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))}
  </div>
);

/**
 * The loading state for a table, matching the eventual column count.
 * @param {object} props
 * @param {number} [props.rows]
 * @param {number} [props.columns]
 * @param {string} [props.label]
 * @returns {import('react').ReactElement}
 */
export const SkeletonTable = ({ rows = 5, columns = 4, label = 'Loading' }) => (
  <div
    className="overflow-hidden rounded-card border border-hairline bg-surface"
    role="status"
    aria-label={label}
  >
    <div className="border-b border-hairline bg-parchment px-3 py-2.5">
      <Skeleton className="h-4 w-32" />
    </div>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div
        key={rowIndex}
        className="flex items-center gap-3 border-b border-hairline px-3 py-3 last:border-b-0"
      >
        {Array.from({ length: columns }, (_, columnIndex) => (
          <Skeleton
            key={columnIndex}
            className={cn('h-4 flex-1', columnIndex === 0 ? 'max-w-48' : 'max-w-28')}
          />
        ))}
      </div>
    ))}
  </div>
);
