import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Badge, Card, PlotIdentityStrip } from '@/components/ui/index.js';
import { formatInr } from '@/lib/format.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE, PROPERTY_TYPE_LABEL } from '@/lib/labels.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { StaticMapThumbnail } from './StaticMapThumbnail.jsx';

/**
 * A catalogue card: cover photo, price (the loudest thing here per Section
 * 7.2), the identity strip, and a Static Maps thumbnail rather than a live
 * map (Section 7.3) — a grid of these never opens an interactive map
 * instance.
 *
 * @param {object} props
 * @param {import('zod').infer<typeof import('@/contracts/index.js').PropertyListItemSchema>} props.property
 * @returns {import('react').ReactElement}
 */
export const PropertyCard = ({ property }) => (
  <Link
    to={buildPath(ROUTES.propertyDetail, { slug: property.slug })}
    className="block h-full rounded-card"
  >
    <Card interactive className="flex h-full flex-col overflow-hidden">
      <div className="aspect-[4/3] w-full overflow-hidden bg-parchment">
        {property.coverImageUrl ? (
          <img
            src={property.coverImageUrl}
            alt={property.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-muted">
            <ImageOff className="size-6" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-lg font-semibold text-ink">
            {formatInr(property.price)}
            {property.priceIsNegotiable && (
              <span className="ml-1.5 text-xs font-normal text-ink-muted">Negotiable</span>
            )}
          </p>
          <Badge tone={PROPERTY_STATUS_TONE[property.status]}>
            {PROPERTY_STATUS_LABEL[property.status]}
          </Badge>
        </div>

        <p className="text-sm text-ink">{property.title}</p>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="muted">{PROPERTY_TYPE_LABEL[property.propertyType]}</Badge>
          {property.isGroupPurchase && <Badge tone="clay">Group purchase opportunity</Badge>}
        </div>

        <PlotIdentityStrip
          surveyNumber={property.surveyNumber}
          areaValue={property.areaValue}
          areaUnit={property.areaUnit}
          locality={property.locality ?? property.city}
          size="sm"
        />

        <StaticMapThumbnail
          latitude={property.latitude}
          longitude={property.longitude}
          label={property.title}
          height={96}
          className="mt-auto"
        />
      </div>
    </Card>
  </Link>
);
