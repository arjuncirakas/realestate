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
import { PropertyGallery, PropertyLocationMap } from '@/components/property/index.js';
import { usePropertyDetail } from '@/api/properties.js';
import { formatAddress, formatInr } from '@/lib/format.js';
import { RegisterInterestForm } from '@/features/subscriber/forms/RegisterInterestForm.jsx';
import { ROUTES } from '@/routes/paths.js';

/**
 * `/group-purchase/:slug` — the offer detail and register-interest form
 * (Section 7.1), built on the same `GET /properties/:slug` record as the
 * catalogue detail page. This route exists separately from it because the
 * only call to action here is registering interest — there is no enquiry or
 * site-visit form on this page, those live on `/properties/:slug`.
 *
 * Section 1.3 governs every line of copy below: `groupTargetAmount` and
 * `groupMinTicket` are shown as two plain labelled figures, never as a fill
 * state, a percentage, or a countdown, and the copy around them is explicit
 * that registering is an enquiry rather than a payment or a binding
 * commitment.
 *
 * @returns {import('react').ReactElement}
 */
export default function GroupPurchaseDetailPage() {
  const { slug } = useParams();
  const { data: property, isPending, isError, error, refetch } = usePropertyDetail(slug);

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Skeleton className="aspect-[4/3] w-full" />
        <SkeletonText lines={4} className="mt-6 max-w-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <ErrorState title="This opportunity did not load" error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link to={ROUTES.groupPurchase} className="hover:text-ink">
          Group purchase opportunities
        </Link>{' '}
        / <span className="text-ink">{property.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <PropertyGallery media={property.media} title={property.title} />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink">{property.title}</h1>
              <p className="mt-1 text-sm text-ink-muted">{formatAddress(property)}</p>
            </div>
            <Badge tone="clay">Group purchase opportunity</Badge>
          </div>

          <p className="mt-3 text-2xl font-semibold text-ink">
            {formatInr(property.price)}
            {property.priceIsNegotiable && (
              <span className="ml-2 text-sm font-normal text-ink-muted">Negotiable</span>
            )}
          </p>

          <PlotIdentityStrip
            className="mt-4"
            surveyNumber={property.surveyNumber}
            areaValue={property.areaValue}
            areaUnit={property.areaUnit}
            locality={property.locality ?? property.city}
            size="md"
          />

          {/* Two plain labelled figures — never a fill bar, a percentage, or a
              countdown (Section 1.3). */}
          <dl className="mt-6 grid grid-cols-1 gap-4 rounded-card border border-hairline bg-parchment p-4 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                Indicative total
              </dt>
              <dd className="mt-1 text-lg font-semibold text-ink">
                {formatInr(property.groupTargetAmount)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                Indicative minimum contribution
              </dt>
              <dd className="mt-1 text-lg font-semibold text-ink">
                {formatInr(property.groupMinTicket)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-ink-muted">
            These are indicative figures only, not a target that fills up. Registering interest
            records an enquiry — it is not a payment and does not reserve or allocate the plot.
            The agency will contact you to discuss next steps.
          </p>

          {property.description && (
            <p className="mt-6 whitespace-pre-line text-sm text-ink">{property.description}</p>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-ink">Location</h2>
            <PropertyLocationMap
              className="mt-2"
              latitude={property.latitude}
              longitude={property.longitude}
              title={property.title}
            />
          </div>
        </div>

        <aside>
          <Card>
            <CardHeader
              title="Register your interest"
              description="The agency will contact you about this opportunity."
            />
            <CardBody>
              <RegisterInterestForm propertyId={property.id} />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
