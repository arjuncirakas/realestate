/**
 * Lets a keyboard user jump past the header navigation.
 *
 * Visually hidden until focused, which is why it uses `sr-only` plus a
 * `focus:not-sr-only` reveal rather than `display: none` — a hidden element is not
 * focusable at all, so it would never appear.
 *
 * @param {{ targetId?: string }} props
 * @returns {import('react').ReactElement}
 */
export const SkipLink = ({ targetId = 'main-content' }) => (
  <a
    href={`#${targetId}`}
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:border focus:border-hairline focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
  >
    Skip to main content
  </a>
);
