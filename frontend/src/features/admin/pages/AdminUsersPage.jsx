import { useState } from 'react';
import { toast } from 'sonner';
import { UserCog } from 'lucide-react';
import {
  Badge,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  SkeletonTable,
  Table,
} from '@/components/ui/index.js';
import { EMPTY_VALUE, formatDate } from '@/lib/format.js';
import { toSelectOptions, USER_ROLE_LABEL } from '@/lib/labels.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { useUpdateUser, useUsersList } from '@/api/users.js';
import { useDebouncedValue } from '@/components/property/index.js';

const ROLE_OPTIONS = toSelectOptions(USER_ROLE_LABEL);
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Role and active-state controls for one row. Editing your own account is
 * disabled here — locking yourself out of the admin role, or your own login,
 * is an easy mistake with no undo from this screen.
 *
 * @param {object} props
 * @param {object} props.targetUser a `UserResponseSchema` row
 * @param {boolean} props.isSelf
 * @returns {import('react').ReactElement}
 */
const UserRowControls = ({ targetUser, isSelf }) => {
  const updateUser = useUpdateUser();

  const handleRoleChange = async (event) => {
    try {
      await updateUser.mutateAsync({ id: targetUser.id, patch: { role: event.target.value } });
      toast.success('Role updated.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not update the role. Try again.');
    }
  };

  const handleActiveToggle = async (event) => {
    try {
      await updateUser.mutateAsync({ id: targetUser.id, patch: { isActive: event.target.checked } });
      toast.success(event.target.checked ? 'Account reactivated.' : 'Account deactivated.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not update the account. Try again.');
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Select
        label={`Role for ${targetUser.fullName}`}
        options={ROLE_OPTIONS}
        value={targetUser.role}
        disabled={isSelf || updateUser.isPending}
        onChange={handleRoleChange}
        className="min-w-36"
      />
      <Checkbox
        label="Active"
        checked={targetUser.isActive}
        disabled={isSelf || updateUser.isPending}
        onChange={handleActiveToggle}
      />
    </div>
  );
};

/**
 * `/admin/users` — role and activation management, admin only both by route
 * guard and by the `/users` endpoint itself (Section 5.2, 5.3).
 * @returns {import('react').ReactElement}
 */
export default function AdminUsersPage() {
  const { user } = useAuth();
  const [role, setRole] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const query = useUsersList({ page, limit: 20, role, q });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage account roles and activation.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Search"
          placeholder="Name or email"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(1);
          }}
          className="min-w-52 flex-1"
        />
        <Select
          label="Role"
          options={ROLE_OPTIONS}
          placeholder="All roles"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          className="min-w-44"
        />
      </div>

      {query.isLoading ? (
        <SkeletonTable rows={8} columns={5} label="Loading users" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<UserCog className="size-8" />}
          title="No users match these filters"
          instruction="Clear a filter to see more accounts."
        />
      ) : (
        <>
          <Table
            caption="Users"
            rowKey={(row) => row.id}
            rows={query.data.items}
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (row) => (
                  <div>
                    <p className="font-semibold text-ink">{row.fullName}</p>
                    <p className="text-xs text-ink-muted">{row.email}</p>
                  </div>
                ),
              },
              { key: 'phone', header: 'Phone', render: (row) => row.phone ?? EMPTY_VALUE },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <Badge tone={row.isActive ? 'moss' : 'muted'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
              },
              { key: 'createdAt', header: 'Joined', render: (row) => formatDate(row.createdAt) },
              {
                key: 'actions',
                header: 'Role and access',
                align: 'right',
                render: (row) => <UserRowControls targetUser={row} isSelf={row.id === user?.id} />,
              },
            ]}
          />
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
