import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn.js';
import { ROUTES } from '@/routes/paths.js';

/**
 * The agency wordmark.
 *
 * Set in mono, like the identity strip, because the register-like typography is
 * the brand here — a land office, not a marketplace.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export const Wordmark = ({ className }) => (
  <Link
    to={ROUTES.home}
    className={cn('inline-flex items-baseline gap-1.5 font-mono text-ink', className)}
  >
    <span className="text-lg font-semibold tracking-tight">Estate</span>
    <span className="hidden text-xs text-ink-muted sm:inline">land records</span>
  </Link>
);
