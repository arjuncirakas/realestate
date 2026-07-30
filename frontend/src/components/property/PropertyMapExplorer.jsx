import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { cn } from '@/lib/cn.js';
import { EmptyState, ErrorState } from '@/components/ui/index.js';
import { formatInr } from '@/lib/format.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { usePropertyMap } from '@/api/properties.js';
import { useDebouncedValue } from './use-debounced-value.js';
import { MapUnavailableNotice } from './MapUnavailableNotice.jsx';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Centred over the seeded districts (Thiruvananthapuram, Kollam, Alappuzha). */
const DEFAULT_CENTER = { lat: 9.05, lng: 76.68 };
const DEFAULT_ZOOM = 9;

/** Section 7.3: do not fire the viewport query on every pan tick. */
const VIEWPORT_DEBOUNCE_MS = 500;

/**
 * The catalogue's map view — Section 7.3's other interactive map instance.
 *
 * The grid/map toggle in `CataloguePage` renders this only while `view` is
 * `'map'`, and it unmounts the moment the toggle flips back, which is what
 * keeps "one interactive map instance per page" true rather than aspirational.
 * The viewport query is debounced at 500ms and the result cached for 5
 * minutes, keyed on the rounded bounds — both inside `usePropertyMap`.
 *
 * @param {object} props
 * @param {{ type?: string, groupPurchaseOnly?: string | boolean }} props.filters
 * @param {string} [props.className]
 * @returns {import('react').ReactElement}
 */
export const PropertyMapExplorer = ({ filters, className }) => {
  const navigate = useNavigate();
  const [bounds, setBounds] = useState(null);
  const debouncedBounds = useDebouncedValue(bounds, VIEWPORT_DEBOUNCE_MS);

  const mapResult = usePropertyMap(debouncedBounds, {
    type: filters.type,
    groupPurchaseOnly: filters.groupPurchaseOnly,
  });

  const handleBoundsChanged = useCallback((event) => {
    setBounds(event.detail.bounds);
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <MapUnavailableNotice
        title="Map view unavailable"
        instruction="The map service is not configured in this environment. Use grid view instead."
        className={cn('h-[420px]', className)}
      />
    );
  }

  const pins = mapResult.data?.items ?? [];

  return (
    <div className={cn('relative h-[520px] overflow-hidden rounded-card border border-hairline', className)}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          onBoundsChanged={handleBoundsChanged}
          className="h-full w-full"
        >
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={{ lat: pin.latitude, lng: pin.longitude }}
              title={`${pin.title} — ${formatInr(pin.price)}`}
              onClick={() => navigate(buildPath(ROUTES.propertyDetail, { slug: pin.slug }))}
            />
          ))}
        </Map>
      </APIProvider>

      {mapResult.isFetching && (
        <p
          className="pointer-events-none absolute left-3 top-3 rounded-card border border-hairline bg-surface/95 px-2.5 py-1 text-xs text-ink-muted"
          role="status"
        >
          Loading plots…
        </p>
      )}

      {mapResult.isError && (
        <div className="absolute inset-x-3 bottom-3">
          <ErrorState
            title="Plots did not load"
            error={mapResult.error}
            onRetry={mapResult.refetch}
            className="bg-surface py-6"
          />
        </div>
      )}

      {!mapResult.isFetching && !mapResult.isError && mapResult.data && pins.length === 0 && (
        <div className="absolute inset-x-3 bottom-3">
          <EmptyState
            title="No plots in this area"
            instruction="Pan or zoom out to see more plots, or clear a filter."
            className="bg-surface py-6"
          />
        </div>
      )}
    </div>
  );
};
