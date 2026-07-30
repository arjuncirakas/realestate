import { cn } from '@/lib/cn.js';
import { EMPTY_VALUE, formatArea } from '@/lib/format.js';

/**
 * The signature element of the design (Section 7.2).
 *
 * Survey number, area in the local unit, and locality, set in `font-mono` against
 * a tinted band. It is the one part of the interface that looks like a document
 * rather than a webpage, and it is what a buyer checks against their paperwork —
 * so it is deliberately plain, monospaced, and never truncated in a way that
 * hides a digit.
 *
 * Every plot card and detail page carries one. At 360px the three cells wrap into
 * a column rather than shrinking the survey number.
 *
 * Lives in `components/ui/` rather than `components/property/` because WP7 owns
 * that folder and every feature needs this — see the WP0.5 notes.
 *
 * @param {object} props
 * @param {string | null} [props.surveyNumber]
 * @param {string | null} [props.areaValue] area as a string from the API
 * @param {string | null} [props.areaUnit] an `AreaUnit` enum value
 * @param {string | null} [props.locality]
 * @param {'md'|'sm'} [props.size] `sm` for a card, `md` for a detail page
 * @param {string} [props.className] layout classes
 * @returns {import('react').ReactElement}
 */
export const PlotIdentityStrip = ({
  surveyNumber,
  areaValue,
  areaUnit,
  locality,
  size = 'md',
  className,
}) => {
  const cells = [
    { label: 'Survey no.', value: surveyNumber || EMPTY_VALUE },
    { label: 'Area', value: formatArea(areaValue, areaUnit) },
    { label: 'Locality', value: locality || EMPTY_VALUE },
  ];

  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-card border border-hairline bg-hairline',
        'grid-cols-1 sm:grid-cols-3',
        className,
      )}
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={cn('bg-parchment', size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2')}
        >
          <dt
            className={cn(
              'font-mono uppercase tracking-wide text-ink-muted',
              size === 'sm' ? 'text-[0.625rem]' : 'text-xs',
            )}
          >
            {cell.label}
          </dt>
          <dd
            className={cn(
              'font-mono text-ink',
              // Survey numbers and areas are checked digit by digit, so they
              // wrap rather than ellipsise.
              'break-words',
              size === 'sm' ? 'text-xs' : 'text-sm',
            )}
          >
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};
