import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPinOff, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  Select,
  SkeletonTable,
  Table,
} from '@/components/ui/index.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE, PROPERTY_TYPE_LABEL, toSelectOptions } from '@/lib/labels.js';
import { formatDate, formatInr } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { PropertyStatus } from '@/contracts/index.js';
import { useAdminPropertiesList, usePublishProperty, useWithdrawProperty } from '@/api/admin-properties.js';
import { useDebouncedValue } from '@/components/property/index.js';

const STATUS_OPTIONS = toSelectOptions(PROPERTY_STATUS_LABEL);
const TYPE_OPTIONS = toSelectOptions(PROPERTY_TYPE_LABEL);
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Row actions: publish (draft only) and, admin-only, withdraw. The withdraw
 * control is hidden from an agent — `DELETE /properties/:id` is admin-only
 * server-side (Section 5.3); this is tidiness, not the security boundary.
 *
 * @param {object} props
 * @param {object} props.property a `PropertyListItemSchema` row
 * @param {boolean} props.isAdmin
 * @param {() => void} props.onRequestWithdraw
 * @returns {import('react').ReactElement}
 */
const RowActions = ({ property, isAdmin, onRequestWithdraw }) => {
  const publishProperty = usePublishProperty();

  const handlePublish = async () => {
    try {
      await publishProperty.mutateAsync(property.id);
      toast.success('Listing published.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not publish this listing. Try again.');
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        as={Link}
        to={buildPath(ROUTES.adminPropertyEdit, { id: property.id })}
        state={{ slug: property.slug }}
        size="sm"
        variant="secondary"
      >
        Edit
      </Button>
      {property.status === PropertyStatus.DRAFT && (
        <Button size="sm" loading={publishProperty.isPending} onClick={handlePublish}>
          Publish listing
        </Button>
      )}
      {isAdmin && property.status !== PropertyStatus.WITHDRAWN && (
        <Button size="sm" variant="danger" onClick={onRequestWithdraw}>
          Withdraw listing
        </Button>
      )}
    </div>
  );
};

/**
 * `/admin/properties` — every listing regardless of status, with filters and
 * per-row publish/withdraw actions (Section 7.1).
 * @returns {import('react').ReactElement}
 */
export default function AdminPropertiesPage() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pendingWithdrawId, setPendingWithdrawId] = useState(null);
  const q = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const query = useAdminPropertiesList({ page, limit: 20, status, type, mine, q });
  const withdrawProperty = useWithdrawProperty();

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const handleConfirmWithdraw = async () => {
    const id = pendingWithdrawId;
    setPendingWithdrawId(null);
    try {
      await withdrawProperty.mutateAsync(id);
      toast.success('Listing withdrawn.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not withdraw this listing. Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Listings</h1>
          <p className="mt-1 text-sm text-ink-muted">Every listing across every status.</p>
        </div>
        <Button as={Link} to={ROUTES.adminPropertyNew} iconLeft={<Plus className="size-4" />}>
          New listing
        </Button>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-4">
          <Input
            label="Search"
            placeholder="Title, locality or survey number"
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
            onChange={updateFilter(setStatus)}
            className="min-w-44"
          />
          <Select
            label="Plot type"
            options={TYPE_OPTIONS}
            placeholder="All types"
            value={type}
            onChange={updateFilter(setType)}
            className="min-w-44"
          />
          <Checkbox
            label="Only my listings"
            checked={mine}
            onChange={(event) => {
              setMine(event.target.checked);
              setPage(1);
            }}
          />
        </CardBody>
      </Card>

      {query.isLoading ? (
        <SkeletonTable rows={8} columns={6} label="Loading listings" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<MapPinOff className="size-8" />}
          title="No listings match these filters"
          instruction="Clear a filter, or create a new listing."
          action={
            <Button as={Link} to={ROUTES.adminPropertyNew} variant="secondary">
              New listing
            </Button>
          }
        />
      ) : (
        <>
          <Table
            caption="Listings"
            rowKey={(row) => row.id}
            rows={query.data.items}
            columns={[
              {
                key: 'title',
                header: 'Title',
                render: (row) => (
                  <div>
                    <p className="font-semibold text-ink">{row.title}</p>
                    <p className="text-xs text-ink-muted">
                      {[row.locality, row.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ),
              },
              { key: 'type', header: 'Type', render: (row) => PROPERTY_TYPE_LABEL[row.propertyType] },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge tone={PROPERTY_STATUS_TONE[row.status]}>
                    {PROPERTY_STATUS_LABEL[row.status]}
                  </Badge>
                ),
              },
              { key: 'price', header: 'Price', numeric: true, render: (row) => formatInr(row.price) },
              { key: 'createdAt', header: 'Created', render: (row) => formatDate(row.createdAt) },
              {
                key: 'actions',
                header: 'Actions',
                srOnlyHeader: true,
                align: 'right',
                render: (row) => (
                  <RowActions
                    property={row}
                    isAdmin={isAdmin}
                    onRequestWithdraw={() => setPendingWithdrawId(row.id)}
                  />
                ),
              },
            ]}
          />
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={pendingWithdrawId !== null}
        onClose={() => setPendingWithdrawId(null)}
        title="Withdraw this listing?"
        description="It moves to withdrawn and disappears from the public catalogue."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingWithdrawId(null)}>
              Keep listing
            </Button>
            <Button variant="danger" loading={withdrawProperty.isPending} onClick={handleConfirmWithdraw}>
              Withdraw listing
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">This can be reviewed again later, but it will no longer be visible to buyers.</p>
      </Modal>
    </div>
  );
}
