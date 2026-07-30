import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
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
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_TONE, toSelectOptions } from '@/lib/labels.js';
import { formatDateTime } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { useAdminEnquiries, useUpdateEnquiry } from '@/api/admin-queues.js';
import { useDebouncedValue } from '@/components/property/index.js';

const STATUS_OPTIONS = toSelectOptions(ENQUIRY_STATUS_LABEL);
const SEARCH_DEBOUNCE_MS = 400;

/**
 * The triage panel for one enquiry: status, assignment, and internal notes
 * (Section 5.2, `PATCH /enquiries/:id`).
 *
 * @param {object} props
 * @param {object} props.enquiry an `EnquiryWithPropertySchema` row
 * @param {() => void} props.onClose
 * @returns {import('react').ReactElement}
 */
const EnquiryManageModal = ({ enquiry, onClose }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState(enquiry.status);
  const [agentNotes, setAgentNotes] = useState(enquiry.agentNotes ?? '');
  const updateEnquiry = useUpdateEnquiry();

  const isAssignedToMe = enquiry.assignedAgentId === user?.id;

  const handleSave = async () => {
    try {
      await updateEnquiry.mutateAsync({
        id: enquiry.id,
        patch: { status, agentNotes: agentNotes.trim() || null },
      });
      toast.success('Enquiry updated.');
      onClose();
    } catch (error) {
      toast.error(error?.message ?? 'Could not save these changes. Try again.');
    }
  };

  const handleAssignment = async (assignedAgentId) => {
    try {
      await updateEnquiry.mutateAsync({ id: enquiry.id, patch: { assignedAgentId } });
      toast.success(assignedAgentId ? 'Assigned to you.' : 'Unassigned.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not update the assignment. Try again.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Manage enquiry"
      description={enquiry.property.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button loading={updateEnquiry.isPending} onClick={handleSave}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-hairline bg-parchment p-3 text-sm">
          <p className="font-semibold text-ink">{enquiry.name}</p>
          <p className="text-ink-muted">{enquiry.email}</p>
          {enquiry.phone && <p className="text-ink-muted">{enquiry.phone}</p>}
          <p className="mt-2 text-ink">{enquiry.message}</p>
        </div>

        <div>
          <p className="text-sm text-ink-muted">
            {enquiry.assignedAgent
              ? `Assigned to ${enquiry.assignedAgent.fullName}`
              : 'Not yet assigned'}
          </p>
          <div className="mt-2 flex gap-2">
            {!isAssignedToMe && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={updateEnquiry.isPending}
                onClick={() => handleAssignment(user.id)}
              >
                Assign to me
              </Button>
            )}
            {enquiry.assignedAgentId && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={updateEnquiry.isPending}
                onClick={() => handleAssignment(null)}
              >
                Unassign
              </Button>
            )}
          </div>
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
 * `/admin/enquiries` — the agent triage queue (Section 7.1).
 * @returns {import('react').ReactElement}
 */
export default function AdminEnquiriesPage() {
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState(null);
  const q = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const query = useAdminEnquiries({ page, limit: 20, status, q });
  const managingEnquiry = query.data?.items.find((item) => item.id === managingId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Enquiries</h1>
        <p className="mt-1 text-sm text-ink-muted">Every message a buyer has sent about a listing.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Search"
          placeholder="Name, email or message"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(1);
          }}
          className="min-w-52 flex-1"
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="min-w-44"
        />
      </div>

      {query.isLoading ? (
        <SkeletonTable rows={6} columns={5} label="Loading enquiries" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<Mail className="size-8" />}
          title="No enquiries match these filters"
          instruction="Clear a filter to see more, or check back once a buyer sends one."
        />
      ) : (
        <>
          <Table
            caption="Enquiries"
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
                key: 'contact',
                header: 'From',
                render: (row) => (
                  <div>
                    <p className="text-ink">{row.name}</p>
                    <p className="text-xs text-ink-muted">{row.email}</p>
                  </div>
                ),
              },
              {
                key: 'assigned',
                header: 'Assigned to',
                render: (row) => row.assignedAgent?.fullName ?? '—',
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={ENQUIRY_STATUS_TONE[row.status]}>{ENQUIRY_STATUS_LABEL[row.status]}</Badge>
                ),
              },
              { key: 'createdAt', header: 'Sent', render: (row) => formatDateTime(row.createdAt) },
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

      {managingEnquiry && (
        <EnquiryManageModal enquiry={managingEnquiry} onClose={() => setManagingId(null)} />
      )}
    </div>
  );
}
