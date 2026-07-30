import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  Select,
  SkeletonTable,
  Table,
  Textarea,
} from '@/components/ui/index.js';
import { EMPTY_VALUE, formatDate, formatDateTime, toDateInputValue } from '@/lib/format.js';
import { toSelectOptions, VISIT_SLOT_LABEL, VISIT_STATUS_LABEL, VISIT_STATUS_TONE } from '@/lib/labels.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useAdminSiteVisits, useUpdateSiteVisit } from '@/api/admin-queues.js';

const STATUS_OPTIONS = toSelectOptions(VISIT_STATUS_LABEL);
const SLOT_OPTIONS = toSelectOptions(VISIT_SLOT_LABEL);

/**
 * The confirm/complete panel for one site visit request (Section 5.2,
 * `PATCH /site-visits/:id`).
 *
 * @param {object} props
 * @param {object} props.visit a `SiteVisitWithPropertySchema` row
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
const VisitManageModal = ({ visit, onClose }) => {
  const [status, setStatus] = useState(visit.status);
  const [preferredDate, setPreferredDate] = useState(toDateInputValue(visit.preferredDate));
  const [preferredSlot, setPreferredSlot] = useState(visit.preferredSlot);
  const [agentNotes, setAgentNotes] = useState(visit.agentNotes ?? '');
  const updateVisit = useUpdateSiteVisit();

  const handleSave = async () => {
    try {
      await updateVisit.mutateAsync({
        id: visit.id,
        patch: { status, preferredDate, preferredSlot, agentNotes: agentNotes.trim() || null },
      });
      toast.success('Site visit updated.');
      onClose();
    } catch (error) {
      toast.error(error?.message ?? 'Could not save these changes. Try again.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Manage site visit"
      description={visit.property.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button loading={updateVisit.isPending} onClick={handleSave}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {visit.contactPhone && (
          <p className="text-sm text-ink-muted">Contact phone: {visit.contactPhone}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Preferred date"
            type="date"
            value={preferredDate}
            onChange={(event) => setPreferredDate(event.target.value)}
          />
          <Select
            label="Preferred time of day"
            options={SLOT_OPTIONS}
            value={preferredSlot}
            onChange={(event) => setPreferredSlot(event.target.value)}
          />
        </div>
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        />
        <Textarea
          label="Agency notes"
          rows={4}
          hint="Visible to agency staff only."
          value={agentNotes}
          onChange={(event) => setAgentNotes(event.target.value)}
        />
      </div>
    </Modal>
  );
};

/**
 * `/admin/visits` — confirm, complete or annotate a site visit request
 * (Section 7.1).
 * @returns {import('react').ReactElement}
 */
export default function AdminVisitsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState(null);

  const query = useAdminSiteVisits({ page, limit: 20, status });
  const managingVisit = query.data?.items.find((item) => item.id === managingId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Site visits</h1>
        <p className="mt-1 text-sm text-ink-muted">Every visit requested, and where each one stands.</p>
      </div>

      <Select
        label="Status"
        options={STATUS_OPTIONS}
        placeholder="All statuses"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          setPage(1);
        }}
        className="max-w-xs"
      />

      {query.isLoading ? (
        <SkeletonTable rows={6} columns={5} label="Loading site visits" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="size-8" />}
          title="No site visits match these filters"
          instruction="Clear a filter to see more, or check back once a buyer requests one."
        />
      ) : (
        <>
          <Table
            caption="Site visits"
            rowKey={(row) => row.id}
            rows={query.data.items}
            columns={[
              {
                key: 'property',
                header: 'Plot',
                render: (row) => (
                  <Link
                    to={buildPath(ROUTES.propertyDetail, { slug: row.property.slug })}
                    className="font-semibold text-ink hover:text-moss hover:underline"
                  >
                    {row.property.title}
                  </Link>
                ),
              },
              {
                key: 'preferredDate',
                header: 'Preferred time',
                render: (row) => `${formatDate(row.preferredDate)}, ${VISIT_SLOT_LABEL[row.preferredSlot]}`,
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
                header: 'Manage',
                srOnlyHeader: true,
                align: 'right',
                render: (row) => (
                  <Button size="sm" variant="secondary" onClick={() => setManagingId(row.id)}>
                    Manage
                  </Button>
                ),
              },
            ]}
          />
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}

      {managingVisit && <VisitManageModal visit={managingVisit} onClose={() => setManagingId(null)} />}
    </div>
  );
}
