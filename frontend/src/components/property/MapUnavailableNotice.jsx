import { MapPin } from 'lucide-react';
import { cn } from '@/lib/cn.js';

/**
 * Stands in for a map — static or interactive — when
 * `VITE_GOOGLE_MAPS_API_KEY` is not configured (Section 7.3, dev note 1).
 *
 * Every map-bearing component in this feature checks for the key before
 * touching `@vis.gl/react-google-maps`, so the app builds and every test
 * passes with no key present, and a visitor sees a labelled placeholder
 * instead of a broken image or a crash.
 *
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.instruction]
 * @param {string} [props.className]
 * @returns {import('react').ReactElement}
 */
export const MapUnavailableNotice = ({
  title = 'Map unavailable',
  instruction = 'The map service is not configured in this environment. The address details below are exact.',
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-1.5 rounded-card border border-hairline bg-parchment px-4 py-8 text-center',
      className,
    )}
    role="status"
  >
    <MapPin className="size-5 text-ink-muted" aria-hidden="true" />
    <p className="text-sm font-semibold text-ink">{title}</p>
    <p className="max-w-prose text-xs text-ink-muted">{instruction}</p>
  </div>
);
