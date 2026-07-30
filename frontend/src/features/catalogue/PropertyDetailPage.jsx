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
import { formatAddress, formatDate, formatInr, formatInrExact } from '@/lib/format.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE, PROPERTY_TYPE_LABEL } from '@/lib/labels.js';
import { EnquiryForm } from '@/features/subscriber/forms/EnquiryForm.jsx';
import { SiteVisitForm } from '@/features/subscriber/forms/SiteVisitForm.jsx';
import { RegisterInterestForm } from '@/features/subscriber/forms/RegisterInterestForm.jsx';
import { ROUTES } from '@/routes/paths.js';

/**
 * `/properties/:slug` — gallery, specs, map, enquiry form and visit-booking
 * CTA (Section 7.1). The enquiry, site-visit and register-interest forms are
 * WP8's; this page only embeds them and supplies `propertyId` — each one
 * gates itself on a session and shows its own sign-in prompt where a session
 * is required, so this page does not repeat that check.
 *
 * @returns {import('react').ReactElement}
 */
export default function PropertyDetailPage() {
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
        <ErrorState title="This plot record did not load" error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link to={ROUTES.properties} className="hover:text-ink">
          Plots
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
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={PROPERTY_STATUS_TONE[property.status]}>
                {PROPERTY_STATUS_LABEL[property.status]}
              </Badge>
              <Badge tone="muted">{PROPERTY_TYPE_LABEL[property.propertyType]}</Badge>
            </div>
          </div>

          <p className="mt-3 text-2xl font-semibold text-ink">
            {formatInr(property.price)}
            {property.priceIsNegotiable && (
              <span className="ml-2 text-sm font-normal text-ink-muted">Negotiable</span>
            )}
          </p>
          <p className="text-xs text-ink-muted">{formatInrExact(property.price)}</p>

          <PlotIdentityStrip
            className="mt-4"
            surveyNumber={property.surveyNumber}
            areaValue={property.areaValue}
            areaUnit={property.areaUnit}
            locality={property.locality ?? property.city}
            size="md"
          />

          {property.isGroupPurchase && (
            <div className="mt-4 rounded-card border border-clay/30 bg-clay/5 p-4">
              <p className="text-sm font-semibold text-ink">Group purchase opportunity</p>
              <p className="mt-1 text-sm text-ink-muted">
                {property.groupTargetAmount &&
                  `Indicative amount ${formatInr(property.groupTargetAmount)}. `}
                {property.groupMinTicket &&
                  `Indicative minimum contribution ${formatInr(property.groupMinTicket)}. `}
                Registering interest is an enquiry, not a payment or a commitment — the agency
                contacts you to discuss next steps.
              </p>
            </div>
          )}

          {property.description && (
            <p className="mt-6 whitespace-pre-line text-sm text-ink">{property.description}</p>
          )}

          {property.amenities?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {property.amenities.map((amenity) => (
                <Badge key={amenity} tone="neutral">
                  {amenity}
                </Badge>
              ))}
            </div>
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

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-hairline pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted">Listed by</dt>
              <dd className="text-ink">{property.listedByAgent?.fullName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Published</dt>
              <dd className="text-ink">{formatDate(property.publishedAt)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Views</dt>
              <dd className="text-ink">{property.viewCount}</dd>
            </div>
          </dl>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Enquire about this plot" />
            <CardBody>
              <EnquiryForm propertyId={property.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Request a site visit" />
            <CardBody>
              <SiteVisitForm propertyId={property.id} />
            </CardBody>
          </Card>

          {property.isGroupPurchase && (
            <Card>
              <CardHeader title="Register your interest" />
              <CardBody>
                <RegisterInterestForm propertyId={property.id} />
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
