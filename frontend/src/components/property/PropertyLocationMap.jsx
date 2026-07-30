import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { cn } from '@/lib/cn.js';
import { MapUnavailableNotice } from './MapUnavailableNotice.jsx';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * The detail page's one interactive map instance (Section 7.3): a single pin
 * at the plot's coordinates. It only exists while the detail page is mounted
 * — there is no viewport query here, so it costs one map load and nothing
 * more for as long as the visitor stays on the page.
 *
 * @param {object} props
 * @param {number | null} props.latitude
 * @param {number | null} props.longitude
 * @param {string} [props.title] plot title, used as the marker's accessible label
 * @param {string} [props.className]
 * @returns {import('react').ReactElement}
 */
export const PropertyLocationMap = ({ latitude, longitude, title, className }) => {
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  if (!GOOGLE_MAPS_API_KEY || !hasCoordinates) {
    return (
      <MapUnavailableNotice
        instruction={
          hasCoordinates
            ? undefined
            : 'No coordinates recorded for this plot yet. Ask the agency for directions.'
        }
        className={cn('h-72', className)}
      />
    );
  }

  const center = { lat: latitude, lng: longitude };

  return (
    <div className={cn('h-72 overflow-hidden rounded-card border border-hairline', className)}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={15}
          gestureHandling="cooperative"
          disableDefaultUI
          className="h-full w-full"
        >
          <Marker position={center} title={title} />
        </Map>
      </APIProvider>
    </div>
  );
};
