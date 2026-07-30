import { Bookmark, CalendarCheck, Mail, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardFooter, Skeleton } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { ROUTES } from '@/routes/paths.js';
import { useSavedPlots } from '@/api/saved.js';
import { useMyEnquiries } from '@/api/enquiries.js';
import { useMySiteVisits } from '@/api/visits.js';
import { useMyInterests } from '@/api/interests.js';

/** A single count is enough for each summary card — the narrowest query that gets `meta.total`. */
const SUMMARY_QUERY = { page: 1, limit: 1 };

/**
 * One overview tile: an icon, a count drawn from its own query, and a link to
 * the full list. Loading and error are handled per tile rather than for the
 * page as a whole, since each count comes from an independent request.
 *
 * @param {object} props
 * @param {import('react').ElementType} props.icon
 * @param {string} props.title
 * @param {string} props.to
 * @param {string} props.ctaLabel
 * @param {{ isLoading: boolean, isError: boolean, data?: { meta: { total: number } } }} props.query
 * @returns {import('react').ReactElement}
 */
const OverviewCard = ({ icon: Icon, title, to, ctaLabel, query }) => (
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
 * `/dashboard` — a subscriber's record at a glance: how many plots they have
 * saved, and where their enquiries, site visits and registered interest stand.
 * @returns {import('react').ReactElement}
 */
export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const saved = useSavedPlots(SUMMARY_QUERY);
  const enquiries = useMyEnquiries(SUMMARY_QUERY);
  const visits = useMySiteVisits(SUMMARY_QUERY);
  const interests = useMyInterests(SUMMARY_QUERY);
  const firstName = user?.fullName?.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          A record of your saved plots, enquiries, site visits and registered interest.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          icon={Bookmark}
          title="Saved plots"
          to={ROUTES.saved}
          ctaLabel="View saved plots"
          query={saved}
        />
        <OverviewCard
          icon={Mail}
          title="Enquiries"
          to={ROUTES.enquiries}
          ctaLabel="View enquiries"
          query={enquiries}
        />
        <OverviewCard
          icon={CalendarCheck}
          title="Site visits"
          to={ROUTES.visits}
          ctaLabel="View site visits"
          query={visits}
        />
        <OverviewCard
          icon={Users}
          title="Registered interest"
          to={ROUTES.interests}
          ctaLabel="View registered interest"
          query={interests}
        />
      </div>
    </div>
  );
}
