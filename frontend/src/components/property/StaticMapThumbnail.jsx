import { createStaticMapsUrl } from '@vis.gl/react-google-maps';
import { cn } from '@/lib/cn.js';
import { MapUnavailableNotice } from './MapUnavailableNotice.jsx';

/** A separate, referrer-restricted key from the server-side geocoding key (Section 7.3). */
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * The only map a card or a grid is allowed to render (Section 7.3): a single
 * Static Maps API image, not an interactive map instance. The image is a
 * plain `<img>`, so the browser caches it by URL the same way it caches any
 * other picture — there is nothing extra for this component to cache itself.
 *
 * Twenty of these on a catalogue page cost twenty static-map calls; twenty
 * `<Map>` instances would cost twenty live map sessions, which is the
 * distinction this component exists to enforce.
 *
 * @param {object} props
 * @param {number | null} [props.latitude]
 * @param {number | null} [props.longitude]
 * @param {string} [props.label] used in the alt text and the placeholder
 * @param {number} [props.width] source image width in px
 * @param {number} [props.height] source image height in px, also the CSS height
 * @param {number} [props.zoom]
 * @param {string} [props.className] layout classes
 * @returns {import('react').ReactElement}
 */
export const StaticMapThumbnail = ({
  latitude,
  longitude,
  label,
  width = 480,
  height = 120,
  zoom = 14,
  className,
}) => {
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  if (!GOOGLE_MAPS_API_KEY || !hasCoordinates) {
    return (
      <MapUnavailableNotice
        title="Map unavailable"
        instruction={hasCoordinates ? undefined : 'No coordinates recorded for this plot yet.'}
        className={cn('py-3', className)}
      />
    );
  }

  const url = createStaticMapsUrl({
    apiKey: GOOGLE_MAPS_API_KEY,
    width,
    height,
    center: { lat: latitude, lng: longitude },
    zoom,
    scale: 2,
    markers: [{ location: { lat: latitude, lng: longitude }, color: '0x3F6B4A' }],
  });

  return (
    <img
      src={url}
      alt={label ? `Map showing the location of ${label}` : 'Map showing the plot location'}
      loading="lazy"
      width={width}
      height={height}
      className={cn('w-full rounded-card border border-hairline object-cover', className)}
    />
  );
};
