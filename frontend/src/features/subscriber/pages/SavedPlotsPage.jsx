import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
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
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE } from '@/lib/labels.js';
import { formatInr } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { useSavedPlots, useUnsavePlot } from '@/api/saved.js';

/**
 * `/dashboard/saved` — the plots a subscriber has bookmarked for later.
 * @returns {import('react').ReactElement}
 */
export default function SavedPlotsPage() {
  const [page, setPage] = useState(1);
  const query = useSavedPlots({ page });
  const unsavePlot = useUnsavePlot();

  const handleRemove = async (propertyId) => {
    try {
      await unsavePlot.mutateAsync(propertyId);
      toast.success('Removed from saved plots.');
    } catch (error) {
      toast.error(error.message ?? 'Could not remove this plot. Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Saved plots</h1>
        <p className="mt-1 text-sm text-ink-muted">Plots you have bookmarked for later.</p>
      </div>

      {query.isLoading ? (
        <SkeletonCardGrid count={6} label="Loading your saved plots" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-8" />}
          title="No saved plots yet"
          instruction="Browse the catalogue to save one."
          action={
            <Button as={Link} to={ROUTES.properties} variant="secondary">
              Browse the catalogue
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.items.map((row) => {
              const detailPath = buildPath(ROUTES.propertyDetail, {
                slug: row.property.slug,
              });
              const removing = unsavePlot.isPending && unsavePlot.variables === row.propertyId;

              return (
                <Card key={row.propertyId} className="flex flex-col overflow-hidden">
                  {row.property.coverImageUrl ? (
                    <img
                      src={row.property.coverImageUrl}
                      alt={row.property.title}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-parchment text-ink-muted">
                      <Bookmark className="size-8" aria-hidden="true" />
                    </div>
                  )}
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={detailPath}
                        className="font-semibold text-ink hover:text-moss hover:underline"
                      >
                        {row.property.title}
                      </Link>
                      <Badge tone={PROPERTY_STATUS_TONE[row.property.status]}>
                        {PROPERTY_STATUS_LABEL[row.property.status]}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold text-ink">
                      {formatInr(row.property.price)}
                    </p>
                    <PlotIdentityStrip
                      size="sm"
                      surveyNumber={row.property.surveyNumber}
                      areaValue={row.property.areaValue}
                      areaUnit={row.property.areaUnit}
                      locality={row.property.locality}
                    />
                  </CardBody>
                  <CardFooter className="justify-between">
                    <Button as={Link} to={detailPath} variant="secondary" size="sm">
                      View plot
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={removing}
                      onClick={() => handleRemove(row.propertyId)}
                    >
                      Remove
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
