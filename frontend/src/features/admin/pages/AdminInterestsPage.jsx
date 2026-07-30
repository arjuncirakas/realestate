import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
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
  Textarea,
} from '@/components/ui/index.js';
import { EMPTY_VALUE, formatDateTime, formatInr } from '@/lib/format.js';
import { INTEREST_STATUS_LABEL, INTEREST_STATUS_TONE, toSelectOptions } from '@/lib/labels.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useAdminInterests, useUpdateInterest } from '@/api/admin-queues.js';

const STATUS_OPTIONS = toSelectOptions(INTEREST_STATUS_LABEL);

/**
 * The follow-up panel for one interest registration (Section 5.2,
 * `PATCH /interests/:id`). This is an expression-of-interest register only —
 * Section 1.3 — so nothing here implies a commitment or states a return.
 *
 * @param {object} props
 * @param {object} props.interest an `InterestWithPropertySchema` row
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
const InterestManageModal = ({ interest, onClose }) => {
  const [status, setStatus] = useState(interest.status);
  const [agentNotes, setAgentNotes] = useState(interest.agentNotes ?? '');
  const updateInterest = useUpdateInterest();

  const handleSave = async () => {
    try {
      await updateInterest.mutateAsync({
        id: interest.id,
        patch: { status, agentNotes: agentNotes.trim() || null },
      });
      toast.success('Registration updated.');
      onClose();
    } catch (error) {
      toast.error(error?.message ?? 'Could not save these changes. Try again.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Manage registered interest"
      description={interest.property.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button loading={updateInterest.isPending} onClick={handleSave}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-hairline bg-parchment p-3 text-sm">
          <p className="text-ink-muted">Indicative amount</p>
          <p className="font-semibold text-ink">{formatInr(interest.indicativeAmount)}</p>
          {interest.notes && <p className="mt-2 text-ink">{interest.notes}</p>}
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
 * `/admin/interests` — the group-purchase follow-up queue (Section 7.1). It
 * records expressions of interest only; the agency contacts each registrant
 * individually (Section 1.3).
 * @returns {import('react').ReactElement}
 */
export default function AdminInterestsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState(null);

  const query = useAdminInterests({ page, limit: 20, status });
  const managingInterest = query.data?.items.find((item) => item.id === managingId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Interest register</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every group purchase opportunity enquiry, and the agency's follow-up.
        </p>
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
        <SkeletonTable rows={6} columns={4} label="Loading registered interest" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No registrations match these filters"
          instruction="Clear a filter to see more, or check back once a buyer registers interest."
        />
      ) : (
        <>
          <Table
            caption="Registered interest"
            rowKey={(row) => row.id}
            rows={query.data.items}
            columns={[
              {
                key: 'property',
                header: 'Opportunity',
                render: (row) => (
                  <Link
                    to={buildPath(ROUTES.groupPurchaseDetail, { slug: row.property.slug })}
                    className="font-semibold text-ink hover:text-moss hover:underline"
                  >
                    {row.property.title}
                  </Link>
                ),
              },
              {
                key: 'indicativeAmount',
                header: 'Indicative amount',
                numeric: true,
                render: (row) => formatInr(row.indicativeAmount),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={INTEREST_STATUS_TONE[row.status]}>{INTEREST_STATUS_LABEL[row.status]}</Badge>
                ),
              },
              {
                key: 'createdAt',
                header: 'Registered',
                render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : EMPTY_VALUE),
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

      {managingInterest && (
        <InterestManageModal interest={managingInterest} onClose={() => setManagingId(null)} />
      )}
    </div>
  );
}
