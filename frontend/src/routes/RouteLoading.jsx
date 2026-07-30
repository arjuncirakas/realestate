import { SkeletonText } from '@/components/ui/index.js';

/**
 * Shown while a guard is still deciding whether there is a session.
 *
 * A skeleton rather than a spinner, per Section 9.3, and it reserves roughly the
 * height of a page heading and first block so the layout does not jump when the
 * real content arrives.
 *
 * @returns {import('react').ReactElement}
 */
export const RouteLoading = () => (
  <div className="mx-auto w-full max-w-3xl px-4 py-10" role="status" aria-label="Loading">
    <SkeletonText lines={4} />
  </div>
);
