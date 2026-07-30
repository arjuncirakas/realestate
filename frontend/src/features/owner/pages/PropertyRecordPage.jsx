import { Link, useParams } from 'react-router-dom';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  PlotIdentityStrip,
  Skeleton,
  SkeletonText,
} from '@/components/ui/index.js';
import { StaticMapThumbnail } from '@/components/property/index.js';
import { useMyPropertyDetail } from '@/api/ownership.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { EMPTY_VALUE, formatDate, formatInr } from '@/lib/format.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE } from '@/lib/labels.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { ManagementLogTimeline, OwnershipShareTable, PlotSnapshotGallery } from '../components/index.js';
import { formatSharePercentage } from '../format-share.js';

/**
 * `/dashboard/my-properties/:id` — the ownership record for one plot: the
 * caller's own share, every other registered share on the plot, the
 * agency's management log, and the site photo timeline (Section 7.1).
 *
 * @returns {import('react').ReactElement}
 */
export default function PropertyRecordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useMyPropertyDetail(id);

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="aspect-[4/3] w-full max-w-md" />
        <SkeletonText lines={4} className="max-w-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="This ownership record did not load"
        error={error}
        onRetry={refetch}
        className="mt-4"
      />
    );
  }

  const { property, ownership, ownerships } = data;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link to={ROUTES.myProperties} className="hover:text-ink">
          My plots
        </Link>{' '}
        / <span className="text-ink">{property.title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{property.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[property.locality, property.city].filter(Boolean).join(', ')}
          </p>
        </div>
        <Badge tone={PROPERTY_STATUS_TONE[property.status]}>
          {PROPERTY_STATUS_LABEL[property.status]}
        </Badge>
      </div>

      <PlotIdentityStrip
        surveyNumber={property.surveyNumber}
        areaValue={property.areaValue}
        areaUnit={property.areaUnit}
        locality={property.locality ?? property.city}
        size="md"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Your ownership record" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-ink-muted">Your share</dt>
                  <dd className="font-mono text-ink">
                    {formatSharePercentage(ownership.sharePercentage)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Registered on</dt>
                  <dd className="text-ink">{formatDate(ownership.registeredOn)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Document ref.</dt>
                  <dd className="text-ink">{ownership.documentRef || EMPTY_VALUE}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Plot value</dt>
                  <dd className="text-ink">{formatInr(property.price)}</dd>
                </div>
              </dl>
              {ownership.notes && (
                <p className="mt-4 whitespace-pre-line border-t border-hairline pt-4 text-sm text-ink">
                  {ownership.notes}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Ownership shares"
              description="Every share registered on this plot, not only your own."
            />
            <CardBody>
              <OwnershipShareTable ownerships={ownerships} currentUserId={user?.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Management log" />
            <CardBody>
              <ManagementLogTimeline propertyId={property.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Site photographs" />
            <CardBody>
              <PlotSnapshotGallery propertyId={property.id} propertyTitle={property.title} />
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Location" />
            <CardBody>
              <StaticMapThumbnail
                latitude={property.latitude}
                longitude={property.longitude}
                label={property.title}
                height={160}
              />
              <Link
                to={buildPath(ROUTES.propertyDetail, { slug: property.slug })}
                className="mt-3 inline-block text-sm text-moss hover:underline"
              >
                View public listing
              </Link>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
