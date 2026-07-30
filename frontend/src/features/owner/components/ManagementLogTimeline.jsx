import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Badge, EmptyState, ErrorState, Pagination, SkeletonText } from '@/components/ui/index.js';
import { LOG_TYPE_LABEL } from '@/lib/labels.js';
import { formatDate } from '@/lib/format.js';
import { useMyPropertyLogs } from '@/api/ownership.js';

/**
 * The agency's management log for a plot, as a timeline: date, type, title,
 * notes, and any photographs attached to the entry.
 *
 * Only entries with `isVisibleToOwner: true` ever reach `GET
 * /me/properties/:id/logs` — there is no flag to request the rest, and this
 * component renders nothing suggesting more exist.
 *
 * @param {object} props
 * @param {string} props.propertyId
 * @returns {import('react').ReactElement}
 */
export const ManagementLogTimeline = ({ propertyId }) => {
  const [page, setPage] = useState(1);
  const query = useMyPropertyLogs(propertyId, { page });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading the management log">
        <SkeletonText lines={3} />
        <SkeletonText lines={2} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="The management log did not load"
        error={query.error}
        onRetry={query.refetch}
      />
    );
  }

  if (query.data.items.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-8" />}
        title="No management activity recorded yet"
        instruction="The agency logs inspections, maintenance and other work on this plot here as it happens."
      />
    );
  }

  return (
    <div>
      <ol className="flex flex-col gap-6 border-l border-hairline pl-5">
        {query.data.items.map((log) => (
          <li key={log.id} className="relative">
            <span
              className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-moss bg-parchment"
              aria-hidden="true"
            />
            <p className="font-mono text-xs text-ink-muted">{formatDate(log.occurredOn)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="muted">{LOG_TYPE_LABEL[log.logType]}</Badge>
              <p className="font-semibold text-ink">{log.title}</p>
            </div>
            {log.notes && (
              <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">{log.notes}</p>
            )}
            {log.media.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {log.media.map((item) => (
                  <li key={item.id}>
                    <img
                      src={item.url}
                      alt={item.caption || `Photograph attached to "${log.title}"`}
                      loading="lazy"
                      className="size-20 rounded-card border border-hairline object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <Pagination className="mt-5" meta={query.data.meta} onPageChange={setPage} />
    </div>
  );
};
