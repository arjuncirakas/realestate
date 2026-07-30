import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Pagination,
  Select,
  SkeletonTable,
  Table,
} from '@/components/ui/index.js';
import { VisitStatus } from '@/contracts/index.js';
import { toSelectOptions, VISIT_SLOT_LABEL, VISIT_STATUS_LABEL, VISIT_STATUS_TONE } from '@/lib/labels.js';
import { EMPTY_VALUE, formatDate, formatDateTime } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useCancelSiteVisit, useMySiteVisits } from '@/api/visits.js';

const STATUS_OPTIONS = toSelectOptions(VISIT_STATUS_LABEL);

/** A visit already confirmed or in the past cannot be cancelled from here. */
const CANCELLABLE_STATUSES = [VisitStatus.REQUESTED, VisitStatus.CONFIRMED];

/**
 * `/dashboard/visits` — every site visit a subscriber has requested, its
 * confirmation status, and the option to cancel one that hasn't happened yet.
 * @returns {import('react').ReactElement}
 */
export default function VisitsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [visitToCancel, setVisitToCancel] = useState(null);
  const query = useMySiteVisits({ page, limit: 20, status });
  const cancelVisit = useCancelSiteVisit();

  const handleStatusChange = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelVisit.mutateAsync(visitToCancel.id);
      toast.success('Site visit cancelled.');
      setVisitToCancel(null);
    } catch (error) {
      toast.error(error.message ?? 'Could not cancel the visit. Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Site visits</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every visit you have requested, and its confirmation status.
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
        <SkeletonTable rows={5} columns={5} label="Loading your site visits" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="size-8" />}
          title="No site visits yet"
          instruction="Browse the catalogue and request a site visit for a plot you're interested in."
          action={
            <Button as={Link} to={ROUTES.properties} variant="secondary">
              Browse plots
            </Button>
          }
        />
      ) : (
        <>
          <Table
            caption="Your site visits"
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
                key: 'preferredDate',
                header: 'Preferred time',
                render: (row) =>
                  `${formatDate(row.preferredDate)}, ${VISIT_SLOT_LABEL[row.preferredSlot]}`,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={VISIT_STATUS_TONE[row.status]}>{VISIT_STATUS_LABEL[row.status]}</Badge>
                ),
              },
              {
                key: 'confirmedAt',
                header: 'Confirmed',
                render: (row) => (row.confirmedAt ? formatDateTime(row.confirmedAt) : EMPTY_VALUE),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (row) =>
                  CANCELLABLE_STATUSES.includes(row.status) ? (
                    <Button variant="secondary" size="sm" onClick={() => setVisitToCancel(row)}>
                      Cancel visit
                    </Button>
                  ) : null,
              },
            ]}
          />
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={Boolean(visitToCancel)}
        onClose={() => setVisitToCancel(null)}
        title="Cancel this site visit?"
        description={
          visitToCancel
            ? `${visitToCancel.property.title} — ${formatDate(visitToCancel.preferredDate)}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setVisitToCancel(null)}>
              Keep visit
            </Button>
            <Button variant="danger" loading={cancelVisit.isPending} onClick={handleConfirmCancel}>
              Cancel visit
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          The agency will be notified. You can request a new visit at any time.
        </p>
      </Modal>
    </div>
  );
}
