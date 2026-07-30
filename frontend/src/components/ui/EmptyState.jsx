import { cn } from '@/lib/cn.js';

/**
 * The empty state for a list.
 *
 * Copy rule (Section 7.2): instruct, do not apologise. "No saved plots yet.
 * Browse the catalogue to save one." — not "Sorry, nothing here". The `action` is
 * the next step, so the reader does not have to work out where to go.
 *
 * @param {object} props
 * @param {import('react').ReactNode} [props.icon] a lucide icon element
 * @param {string} props.title what is empty, stated plainly
 * @param {string} props.instruction what to do about it
 * @param {import('react').ReactNode} [props.action] a Button, usually
 * @param {string} [props.className] layout classes
 * @returns {import('react').ReactElement}
 */
export const EmptyState = ({ icon, title, instruction, action, className }) => (
  <div
    className={cn(
      'flex flex-col items-center gap-3 rounded-card border border-hairline bg-surface px-6 py-10 text-center',
      className,
    )}
  >
    {icon && (
      <span className="text-ink-muted" aria-hidden="true">
        {icon}
      </span>
    )}
    <div className="max-w-prose">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{instruction}</p>
    </div>
    {action}
  </div>
);
