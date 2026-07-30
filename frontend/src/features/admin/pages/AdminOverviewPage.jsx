import { CalendarCheck, FileEdit, Mail, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonTable,
  Table,
} from '@/components/ui/index.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE } from '@/lib/labels.js';
import { formatDate } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { EnquiryStatus, InterestStatus, PropertyStatus, VisitStatus } from '@/contracts/index.js';
import { useAdminEnquiries, useAdminInterests, useAdminSiteVisits } from '@/api/admin-queues.js';
import { useAdminPropertiesList } from '@/api/admin-properties.js';

/** The narrowest query that still returns `meta.total` for a count tile (Section 9.3 note on `/admin`). */
const COUNT_QUERY = { page: 1, limit: 1 };
const RECENT_LISTINGS_QUERY = { page: 1, limit: 5, sort: 'newest' };

/**
 * One queue-count tile: an icon, a status-scoped total, and a link through to
 * the full queue.
 * @param {object} props
 * @param {import('react').ElementType} props.icon
 * @param {string} props.title
 * @param {string} props.to
 * @param {string} props.ctaLabel
 * @param {{ isLoading: boolean, isError: boolean, data?: { meta: { total: number } } }} props.query
 * @returns {import('react').ReactElement}
 */
const QueueCountCard = ({ icon: Icon, title, to, ctaLabel, query }) => (
  <Card>
    <CardBody>
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </p>
      {query.isLoading ? (
        <Skeleton className="mt-2 h-9 w-12" />
      ) : query.isError ? (
        <p className="mt-2 text-sm text-clay">Could not load</p>
      ) : (
        <p className="mt-1 text-3xl font-semibold text-ink tabular-nums">{query.data.meta.total}</p>
      )}
    </CardBody>
    <CardFooter>
      <Link to={to} className="text-sm font-semibold text-moss hover:underline">
        {ctaLabel}
      </Link>
    </CardFooter>
  </Card>
);

/**
 * `/admin` — queue counts and recent listing activity, the agency panel's
 * landing page (Section 7.1).
 * @returns {import('react').ReactElement}
 */
export default function AdminOverviewPage() {
  const newEnquiries = useAdminEnquiries({ ...COUNT_QUERY, status: EnquiryStatus.NEW });
  const requestedVisits = useAdminSiteVisits({ ...COUNT_QUERY, status: VisitStatus.REQUESTED });
  const newInterests = useAdminInterests({ ...COUNT_QUERY, status: InterestStatus.NEW });
  const draftListings = useAdminPropertiesList({ ...COUNT_QUERY, status: PropertyStatus.DRAFT });
  const recentListings = useAdminPropertiesList(RECENT_LISTINGS_QUERY);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Agency overview</h1>
        <p className="mt-1 text-sm text-ink-muted">
          What needs attention across enquiries, site visits, interest and listings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCountCard
          icon={Mail}
          title="New enquiries"
          to={ROUTES.adminEnquiries}
          ctaLabel="View enquiries"
          query={newEnquiries}
        />
        <QueueCountCard
          icon={CalendarCheck}
          title="Site visits to confirm"
          to={ROUTES.adminVisits}
          ctaLabel="View site visits"
          query={requestedVisits}
        />
        <QueueCountCard
          icon={Users}
          title="New registered interest"
          to={ROUTES.adminInterests}
          ctaLabel="View interest register"
          query={newInterests}
        />
        <QueueCountCard
          icon={FileEdit}
          title="Draft listings"
          to={ROUTES.adminProperties}
          ctaLabel="View listings"
          query={draftListings}
        />
      </div>

      <Card>
        <CardHeader
          title="Recent listings"
          description="The five most recently created listings."
          action={
            <Link to={ROUTES.adminProperties} className="text-sm font-semibold text-moss hover:underline">
              View all listings
            </Link>
          }
        />
        <CardBody className="p-0">
          {recentListings.isLoading ? (
            <div className="p-4">
              <SkeletonTable rows={5} columns={3} label="Loading recent listings" />
            </div>
          ) : recentListings.isError ? (
            <ErrorState
              className="border-0"
              error={recentListings.error}
              onRetry={recentListings.refetch}
            />
          ) : recentListings.data.items.length === 0 ? (
            <EmptyState
              className="border-0"
              title="No listings yet"
              instruction="Create the first listing to see it here."
            />
          ) : (
            <Table
              caption="Recent listings"
              rowKey={(row) => row.id}
              rows={recentListings.data.items}
              className="border-0"
              columns={[
                {
                  key: 'title',
                  header: 'Title',
                  render: (row) => (
                    <Link
                      to={buildPath(ROUTES.adminPropertyEdit, { id: row.id })}
                      state={{ slug: row.slug }}
                      className="font-semibold text-ink hover:text-moss hover:underline"
                    >
                      {row.title}
                    </Link>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={PROPERTY_STATUS_TONE[row.status]}>
                      {PROPERTY_STATUS_LABEL[row.status]}
                    </Badge>
                  ),
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  render: (row) => formatDate(row.createdAt),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
