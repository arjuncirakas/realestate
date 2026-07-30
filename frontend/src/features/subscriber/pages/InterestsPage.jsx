import { useState } from 'react';
import { Users } from 'lucide-react';
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
import { InterestStatus } from '@/contracts/index.js';
import { INTEREST_STATUS_LABEL, INTEREST_STATUS_TONE, toSelectOptions } from '@/lib/labels.js';
import { EMPTY_VALUE, formatDate, formatInr } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useMyInterests, useWithdrawInterest } from '@/api/interests.js';
import { RegisterInterestForm } from '../forms/RegisterInterestForm.jsx';

const STATUS_OPTIONS = toSelectOptions(INTEREST_STATUS_LABEL);

/** These are the statuses the agency has not yet closed out. */
const OPEN_STATUSES = [InterestStatus.NEW, InterestStatus.CONTACTED, InterestStatus.QUALIFIED];

/**
 * `/dashboard/interests` — a subscriber's group-purchase interest register
 * (Section 1.3: an enquiry mechanism, not an investment product). Lets them
 * withdraw an open registration, or register again for one they withdrew.
 * @returns {import('react').ReactElement}
 */
export default function InterestsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [interestToWithdraw, setInterestToWithdraw] = useState(null);
  const [reregisterRow, setReregisterRow] = useState(null);
  const query = useMyInterests({ page, limit: 20, status });
  const withdrawInterest = useWithdrawInterest();

  const handleStatusChange = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  const handleConfirmWithdraw = async () => {
    try {
      await withdrawInterest.mutateAsync(interestToWithdraw.id);
      toast.success('Interest withdrawn.');
      setInterestToWithdraw(null);
    } catch (error) {
      toast.error(error.message ?? 'Could not withdraw your interest. Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Registered interest</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Group purchase opportunities you have registered interest in. Registering creates no
          commitment — the agency will contact you.
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
        <SkeletonTable rows={5} columns={5} label="Loading your registered interest" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No registered interest yet"
          instruction="Browse group purchase opportunities and register your interest in one."
          action={
            <Button as={Link} to={ROUTES.groupPurchase} variant="secondary">
              Browse group purchase opportunities
            </Button>
          }
        />
      ) : (
        <>
          <Table
            caption="Your registered interest"
            rowKey={(row) => row.id}
            rows={query.data.items}
            columns={[
              {
                key: 'property',
                header: 'Opportunity',
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
                key: 'indicativeAmount',
                header: 'Indicative amount',
                render: (row) =>
                  row.indicativeAmount ? formatInr(row.indicativeAmount) : EMPTY_VALUE,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={INTEREST_STATUS_TONE[row.status]}>
                    {INTEREST_STATUS_LABEL[row.status]}
                  </Badge>
                ),
              },
              {
                key: 'createdAt',
                header: 'Registered',
                render: (row) => formatDate(row.createdAt),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (row) => {
                  if (OPEN_STATUSES.includes(row.status)) {
                    return (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setInterestToWithdraw(row)}
                      >
                        Withdraw interest
                      </Button>
                    );
                  }
                  if (row.status === InterestStatus.WITHDRAWN) {
                    return (
                      <Button variant="secondary" size="sm" onClick={() => setReregisterRow(row)}>
                        Register interest again
                      </Button>
                    );
                  }
                  return null;
                },
              },
            ]}
          />
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={Boolean(interestToWithdraw)}
        onClose={() => setInterestToWithdraw(null)}
        title="Withdraw this registration?"
        description={interestToWithdraw?.property.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInterestToWithdraw(null)}>
              Keep registration
            </Button>
            <Button
              variant="danger"
              loading={withdrawInterest.isPending}
              onClick={handleConfirmWithdraw}
            >
              Withdraw interest
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          You can register your interest again at any time.
        </p>
      </Modal>

      <Modal
        open={Boolean(reregisterRow)}
        onClose={() => setReregisterRow(null)}
        title="Register interest again"
        description={reregisterRow?.property.title}
      >
        {reregisterRow && (
          <RegisterInterestForm
            propertyId={reregisterRow.propertyId}
            onSuccess={() => setReregisterRow(null)}
          />
        )}
      </Modal>
    </div>
  );
}
