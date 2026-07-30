import { cn } from '@/lib/cn.js';

/**
 * A surface panel: 1px hairline border, 6px radius, no shadow beyond `shadow-sm`
 * (Section 7.2).
 *
 * Compose it with the sub-components for anything structured:
 *
 *   <Card>
 *     <CardHeader title="Ownership record" action={<Button size="sm">Edit</Button>} />
 *     <CardBody>…</CardBody>
 *   </Card>
 *
 * @param {object} props
 * @param {boolean} [props.interactive] adds hover affordance, for a card that is a link
 * @param {string} [props.className] layout classes
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export const Card = ({ interactive = false, className, children, ...rest }) => (
  <div
    className={cn(
      'rounded-card border border-hairline bg-surface',
      interactive ? 'transition-colors hover:border-ink-muted' : '',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

/**
 * Card header with an optional right-aligned action.
 *
 * The action wraps below the title at 360px rather than squeezing it.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.action]
 * @param {import('react').ElementType} [props.titleAs] heading level, to keep document outline sane
 * @param {string} [props.className]
 * @returns {import('react').ReactElement}
 */
export const CardHeader = ({
  title,
  description,
  action,
  titleAs: TitleTag = 'h2',
  className,
}) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3',
      className,
    )}
  >
    <div className="min-w-0">
      <TitleTag className="text-lg font-semibold text-ink">{title}</TitleTag>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/**
 * Card content region.
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export const CardBody = ({ className, children }) => (
  <div className={cn('px-4 py-4', className)}>{children}</div>
);

/**
 * Card footer, typically holding the actions for the panel.
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
export const CardFooter = ({ className, children }) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-2 border-t border-hairline bg-parchment px-4 py-3',
      className,
    )}
  >
    {children}
  </div>
);
