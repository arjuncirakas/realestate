import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Button } from './Button.jsx';

/**
 * The error state for a list or panel.
 *
 * Copy rule (Section 7.2): state what happened and what to do next. The `error`
 * is expected to be an `ApiError` from `api/client.js`, whose message is already
 * the safe, human-readable text the backend chose — nothing internal reaches
 * this component, so it is safe to display directly.
 *
 * @param {object} props
 * @param {string} [props.title]
 * @param {{ message?: string, code?: string } | null} [props.error]
 * @param {string} [props.instruction] overrides the default next step
 * @param {() => void} [props.onRetry] renders a retry button when provided
 * @param {string} [props.className] layout classes
 * @returns {import('react').ReactElement}
 */
export const ErrorState = ({
  title = 'That did not load',
  error,
  instruction,
  onRetry,
  className,
}) => {
  const nextStep =
    instruction ??
    (onRetry
      ? 'Try again. If it keeps failing, the office can look it up for you.'
      : 'Reload the page. If it keeps failing, the office can look it up for you.');

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-clay/30 bg-clay/5 px-6 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="size-6 text-clay" aria-hidden="true" />
      <div className="max-w-prose">
        <p className="text-lg font-semibold text-ink">{title}</p>
        {error?.message && <p className="mt-1 text-sm text-ink">{error.message}</p>}
        <p className="mt-1 text-sm text-ink-muted">{nextStep}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
};
