import { cn } from '@/lib/cn.js';

/**
 * Label, hint and error scaffolding shared by every form control.
 *
 * It exists so the quality floor is structural rather than remembered: a control
 * built on Field always has a real `<label for>`, and its hint and error are
 * wired to the input through `aria-describedby`, so a screen reader announces the
 * reason a field was rejected instead of just "invalid".
 *
 * Controls pass `renderControl` the ids they must attach.
 *
 * @param {object} props
 * @param {string} props.id id of the control being labelled
 * @param {string} props.label visible label text, sentence case
 * @param {boolean} [props.required] adds a "required" marker
 * @param {string} [props.hint] guidance shown below the control
 * @param {string} [props.error] validation message; replaces the hint when present
 * @param {string} [props.className] layout classes for the wrapper
 * @param {(ids: { id: string, describedBy: string | undefined, invalid: boolean }) => import('react').ReactNode} props.renderControl
 * @returns {import('react').ReactElement}
 */
export const Field = ({ id, label, required, hint, error, className, renderControl }) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  // The error replaces the hint visually, so only the visible one is announced.
  const describedBy = error ? errorId : hintId;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {required && (
          <span className="text-clay ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      {renderControl({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} className="text-xs text-clay" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
};
