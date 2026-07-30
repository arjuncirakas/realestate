import { useState } from 'react';
import { ImageOff, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  EmptyState,
  ErrorState,
  Pagination,
  PlotIdentityStrip,
  SkeletonCardGrid,
} from '@/components/ui/index.js';
import { formatInr } from '@/lib/format.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE } from '@/lib/labels.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useMyProperties } from '@/api/ownership.js';
import { formatSharePercentage } from '../format-share.js';

/**
 * `/dashboard/my-properties` — every plot the signed-in user owns, in whole
 * or in part.
 *
 * Ownership is a data relationship rather than a role (Section 13: "owner" is
 * not a `UserRole`), so any signed-in visitor can land here — whether they
 * own anything is answered by this page's own empty state, not a guard.
 *
 * @returns {import('react').ReactElement}
 */
export default function MyPropertiesPage() {
  const [page, setPage] = useState(1);
  const query = useMyProperties({ page });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My plots</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Plots registered against your account, and your recorded share in each.
        </p>
      </div>

      {query.isPending ? (
        <SkeletonCardGrid count={4} label="Loading your plots" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="size-8" />}
          title="No plots recorded against your account yet"
          instruction="If you have bought through the agency, contact the office and they will add the record."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.items.map(({ property, ownership }, index) => {
              const detailPath = buildPath(ROUTES.myPropertyDetail, { id: property.id });

              return (
                <Card key={ownership.id} className="flex flex-col overflow-hidden">
                  {property.coverImageUrl ? (
                    /*
                      The first card is above the fold and measured as this
                      page's LCP element. `loading="lazy"` defers its discovery
                      until layout, which cost roughly 1.4s of LCP; the rest of
                      the grid still defers.
                    */
                    <img
                      src={property.coverImageUrl}
                      alt={property.title}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-parchment text-ink-muted">
                      <ImageOff className="size-8" aria-hidden="true" />
                    </div>
                  )}
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={detailPath}
                        className="font-semibold text-ink hover:text-moss hover:underline"
                      >
                        {property.title}
                      </Link>
                      <Badge tone={PROPERTY_STATUS_TONE[property.status]}>
                        {PROPERTY_STATUS_LABEL[property.status]}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-ink">{formatInr(property.price)}</p>
                      <Badge tone="moss">
                        Your share: {formatSharePercentage(ownership.sharePercentage)}
                      </Badge>
                    </div>

                    <PlotIdentityStrip
                      size="sm"
                      surveyNumber={property.surveyNumber}
                      areaValue={property.areaValue}
                      areaUnit={property.areaUnit}
                      locality={property.locality ?? property.city}
                    />
                  </CardBody>
                  <CardFooter>
                    <Button as={Link} to={detailPath} variant="secondary" size="sm">
                      View record
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
