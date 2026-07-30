import { useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn.js';

/**
 * A labelled checkbox.
 *
 * The native input stays in the DOM and keeps every keyboard and assistive
 * behaviour; it is made transparent and layered over a drawn box so the tick can
 * be styled. `focus-ring-host` moves the focus outline onto the visible box —
 * without it the ring would be drawn around an invisible input.
 *
 * @param {object} props
 * @param {string} props.label sentence case
 * @param {string} [props.description] secondary line under the label
 * @param {string} [props.id] generated when omitted
 * @param {string} [props.error]
 * @param {string} [props.className] layout classes for the wrapper
 * @returns {import('react').ReactElement}
 */
export const Checkbox = ({ label, description, id, error, className, ...inputProps }) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="focus-ring-host flex items-start gap-2.5">
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input
            id={fieldId}
            type="checkbox"
            aria-describedby={error ? errorId : descriptionId}
            aria-invalid={Boolean(error) || undefined}
            className="peer size-5 cursor-pointer appearance-none rounded-card border border-hairline bg-surface checked:border-moss checked:bg-moss disabled:cursor-not-allowed disabled:bg-parchment"
            {...inputProps}
          />
          <Check
            className="pointer-events-none absolute left-0.5 top-0.5 size-4 text-parchment opacity-0 peer-checked:opacity-100"
            aria-hidden="true"
            strokeWidth={3}
          />
        </span>

        <span className="flex flex-col gap-0.5">
          <label htmlFor={fieldId} className="cursor-pointer text-sm text-ink">
            {label}
          </label>
          {description && (
            <span id={descriptionId} className="text-xs text-ink-muted">
              {description}
            </span>
          )}
        </span>
      </div>

      {error && (
        <p id={errorId} className="text-xs text-clay" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
