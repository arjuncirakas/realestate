import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  SkeletonTable,
  Table,
} from '@/components/ui/index.js';
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_TONE, toSelectOptions } from '@/lib/labels.js';
import { formatDate } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useMyEnquiries } from '@/api/enquiries.js';

const STATUS_OPTIONS = toSelectOptions(ENQUIRY_STATUS_LABEL);

/**
 * `/dashboard/enquiries` — every message a subscriber has sent the agency
 * about a plot, and where the agency stands on each one.
 * @returns {import('react').ReactElement}
 */
export default function EnquiriesPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useMyEnquiries({ page, limit: 20, status });

  const handleStatusChange = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Your enquiries</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every message you have sent to the agency about a plot.
        </p>
      </div>

      <Select
        label="Status"
        options={STATUS_OPTIONS}
        placeholder="All statuses"
        value={status}
        onChange={handleStatusChange}
        className="max-w-xs"
      />

      {query.isLoading ? (
        <SkeletonTable rows={5} columns={4} label="Loading your enquiries" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<Mail className="size-8" />}
          title="No enquiries yet"
          instruction="Browse the catalogue and send an enquiry about a plot you're interested in."
          action={
            <Button as={Link} to={ROUTES.properties} variant="secondary">
              Browse plots
            </Button>
          }
        />
      ) : (
        <>
          <Table
            caption="Your enquiries"
            rowKey={(row) => row.id}
            rows={query.data.items}
            columns={[
              {
                key: 'property',
                header: 'Plot',
                render: (row) => (
                  <div>
                    <Link
                      to={buildPath(ROUTES.propertyDetail, { slug: row.property.slug })}
                      className="font-semibold text-ink hover:text-moss hover:underline"
                    >
                      {row.property.title}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {[row.property.locality, row.property.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ),
              },
              {
                key: 'message',
                header: 'Message',
                render: (row) => (
                  <p className="max-w-sm text-ink-muted line-clamp-2">{row.message}</p>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={ENQUIRY_STATUS_TONE[row.status]}>
                    {ENQUIRY_STATUS_LABEL[row.status]}
                  </Badge>
                ),
              },
              {
                key: 'createdAt',
                header: 'Sent',
                render: (row) => formatDate(row.createdAt),
              },
            ]}
          />
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
