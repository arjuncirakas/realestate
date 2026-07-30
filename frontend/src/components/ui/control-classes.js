import { cn } from '@/lib/cn.js';

/**
 * Shared visual treatment for the box of a text-like control: 1px hairline
 * border, 6px radius, and a clay border when invalid (Section 7.2).
 *
 * In its own module rather than beside `Field` so that file exports only
 * components and keeps fast refresh working.
 *
 * @param {{ invalid?: boolean }} [options]
 * @returns {string}
 */
export const controlClasses = ({ invalid = false } = {}) =>
  cn(
    'w-full rounded-card border bg-surface px-3 py-2 text-base text-ink',
    'disabled:cursor-not-allowed disabled:bg-parchment disabled:text-ink-muted',
    invalid ? 'border-clay' : 'border-hairline',
  );
