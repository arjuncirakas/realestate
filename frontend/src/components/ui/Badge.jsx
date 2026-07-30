import { cn } from '@/lib/cn.js';

/**
 * Tone treatments. Tinted backgrounds rather than saturated fills, so a table of
 * twenty rows does not turn into a set of traffic lights.
 */
const TONES = Object.freeze({
  neutral: 'border-hairline bg-parchment text-ink',
  muted: 'border-hairline bg-parchment text-ink-muted',
  moss: 'border-moss/30 bg-moss/10 text-moss-dark',
  clay: 'border-clay/30 bg-clay/10 text-clay',
});

/**
 * A small status pill.
 *
 * Pair it with the label and tone maps in `lib/labels.js` so a status reads
 * identically in every queue:
 *
 *   <Badge tone={PROPERTY_STATUS_TONE[p.status]}>{PROPERTY_STATUS_LABEL[p.status]}</Badge>
 *
 * @param {object} props
 * @param {'neutral'|'muted'|'moss'|'clay'} [props.tone]
 * @param {string} [props.className] layout classes
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export const Badge = ({ tone = 'neutral', className, children }) => (
  <span
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-card border px-2 py-0.5 text-xs',
      TONES[tone] ?? TONES.neutral,
      className,
    )}
  >
    {children}
  </span>
);
