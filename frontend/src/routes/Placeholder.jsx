import { Link } from 'react-router-dom';
import { Button, EmptyState } from '@/components/ui/index.js';
import { ROUTES } from './paths.js';

/**
 * Stands in for a page whose work package has not landed yet.
 *
 * The router has to reference a real component for every route in Section 7.1, or
 * the app will not build. This keeps the whole route table navigable from day one,
 * so shells, guards and links can be exercised before any feature exists — and
 * each feature WP replaces one `element={...}` with its own page.
 *
 * @param {{ title: string, workPackage: string }} props
 * @param {string} props.title the page named in Section 7.1
 * @param {string} props.workPackage which package builds it, e.g. "WP7"
 * @returns {import('react').ReactElement}
 */
export const Placeholder = ({ title, workPackage }) => (
  <div className="mx-auto w-full max-w-2xl px-4 py-10">
    <EmptyState
      title={title}
      instruction={`This page is built by ${workPackage} and is not wired up yet.`}
      action={
        <Button as={Link} to={ROUTES.home} variant="secondary" size="sm">
          Back to the home page
        </Button>
      }
    />
  </div>
);

/**
 * The 404 page for an unmatched route.
 * @returns {import('react').ReactElement}
 */
export const NotFound = () => (
  <div className="mx-auto w-full max-w-2xl px-4 py-10">
    <EmptyState
      title="That page does not exist"
      instruction="Check the address, or start from the catalogue to find a plot."
      action={
        <Button as={Link} to={ROUTES.properties} variant="secondary" size="sm">
          Browse plots
        </Button>
      }
    />
  </div>
);
