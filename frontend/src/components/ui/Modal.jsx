import { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn.js';

const SIZES = Object.freeze({
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
});

/**
 * A modal dialog.
 *
 * Built on the native `<dialog>` element and `showModal()`, which gives the focus
 * trap, the Escape-to-close behaviour, focus restoration to the trigger, and
 * inertness of the page behind it for free. Every hand-rolled React modal has to
 * reimplement those four things, and usually gets at least one wrong.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose called by Escape, the backdrop, and the close button
 * @param {string} props.title announced as the dialog's accessible name
 * @param {string} [props.description]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {import('react').ReactNode} [props.footer] actions row
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export const Modal = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
}) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // `cancel` fires on Escape. Prevented and routed through onClose so React
  // state stays the single source of truth for whether the dialog is open.
  const handleCancel = useCallback(
    (event) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  /**
   * Closes when the click landed on the dialog element itself, which is the
   * backdrop area — clicks inside the panel hit a child instead.
   * @param {import('react').MouseEvent} event
   * @returns {void}
   */
  const handleBackdropClick = (event) => {
    if (event.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        // `open:` is needed because a closed dialog must stay display:none.
        'm-auto w-[calc(100vw-2rem)] rounded-card border border-hairline bg-surface p-0 text-ink shadow-sm',
        'backdrop:bg-ink/40',
        SIZES[size],
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-sm text-ink-muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 rounded-card p-1.5 text-ink-muted hover:bg-parchment hover:text-ink"
          aria-label="Close dialog"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="max-h-[70dvh] overflow-y-auto px-4 py-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-parchment px-4 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
};
