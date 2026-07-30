import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn.js';

/**
 * Variant appearances. Restraint is the point (Section 7.2): one filled button
 * per view, everything else outlined or quiet, no gradients, no shadow above
 * `shadow-sm`.
 */
const VARIANTS = Object.freeze({
  primary: 'bg-moss text-parchment border-moss hover:bg-moss-dark hover:border-moss-dark',
  secondary: 'bg-surface text-ink border-hairline hover:bg-parchment',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-parchment',
  danger: 'bg-surface text-clay border-clay hover:bg-clay hover:text-parchment',
});

const SIZES = Object.freeze({
  // 44px and 36px tall — both clear the comfortable touch target at 360px.
  md: 'min-h-11 px-4 py-2 text-base',
  sm: 'min-h-9 px-3 py-1.5 text-sm',
});

/**
 * A button, or any element styled as one.
 *
 * Label it with the outcome it produces — "Register interest", "Request site
 * visit", "Save plot" — never "Submit" (Section 7.2).
 *
 * @param {object} props
 * @param {import('react').ElementType} [props.as] render as something else, e.g. react-router's `Link`
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant]
 * @param {'md'|'sm'} [props.size]
 * @param {boolean} [props.loading] shows a spinner and blocks interaction
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.fullWidth] stretch to the container, for narrow screens
 * @param {import('react').ReactNode} [props.iconLeft]
 * @param {string} [props.className] layout classes only
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export const Button = ({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconLeft,
  className,
  children,
  ...rest
}) => {
  const isInactive = disabled || loading;

  return (
    <Component
      // A non-button element rendered as a button still needs a role and to be
      // reachable, and must not be activated while inactive.
      {...(Component === 'button' ? { type: rest.type ?? 'button', disabled: isInactive } : {})}
      aria-disabled={Component === 'button' ? undefined : isInactive || undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-card border text-center',
        'transition-colors',
        'disabled:opacity-60 disabled:cursor-not-allowed aria-disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        iconLeft && (
          <span className="shrink-0" aria-hidden="true">
            {iconLeft}
          </span>
        )
      )}
      <span>{children}</span>
    </Component>
  );
};
