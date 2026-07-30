import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { EmptyState, ErrorState, Pagination, SkeletonCardGrid } from '@/components/ui/index.js';
import { formatDateTime } from '@/lib/format.js';
import { useMyPropertySnapshots } from '@/api/ownership.js';

/**
 * The periodic site photograph timeline (Section 1.1): plain photographs the
 * agency has captured on visits, newest first, each dated. This is the "site
 * photo gallery" from the Section 7.1 route description — distinct from
 * `PropertyGallery`, which carousels the listing's own marketing media and
 * expects a different response shape (`PropertyMediaResponseSchema`, not
 * `PlotSnapshotResponseSchema`).
 *
 * @param {object} props
 * @param {string} props.propertyId
 * @param {string} props.propertyTitle used in each photograph's alt text
 * @returns {import('react').ReactElement}
 */
export const PlotSnapshotGallery = ({ propertyId, propertyTitle }) => {
  const [page, setPage] = useState(1);
  const query = useMyPropertySnapshots(propertyId, { page });

  if (query.isPending) {
    return <SkeletonCardGrid count={8} label="Loading site photographs" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="The site photographs did not load"
        error={query.error}
        onRetry={query.refetch}
      />
    );
  }

  if (query.data.items.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="size-8" />}
        title="No site photographs yet"
        instruction="The agency uploads photographs here after a site visit."
      />
    );
  }

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {query.data.items.map((snapshot) => (
          <li key={snapshot.id}>
            <img
              src={snapshot.url}
              alt={`Site photograph of ${propertyTitle}, captured ${formatDateTime(snapshot.capturedAt)}`}
              loading="lazy"
              className="aspect-square w-full rounded-card border border-hairline object-cover"
            />
            <p className="mt-1 text-xs text-ink-muted">{formatDateTime(snapshot.capturedAt)}</p>
          </li>
        ))}
      </ul>
      <Pagination className="mt-4" meta={query.data.meta} onPageChange={setPage} />
    </div>
  );
};
