import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/index.js';
import { loginPathFor } from '@/routes/next-path.js';

/**
 * Shown in place of a form that needs a session, so a signed-out visitor sees
 * what to do next rather than a silently missing form or a failed request.
 * Signing in returns them to the page they were on (Section 7.1).
 *
 * @param {object} props
 * @param {string} props.action what signing in lets them do, e.g. "request a site visit"
 * @returns {import('react').ReactElement}
 */
export const SignInPrompt = ({ action }) => {
  const location = useLocation();

  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-hairline bg-parchment p-4 text-sm text-ink-muted">
      <p>Sign in to {action}.</p>
      <Button as={Link} to={loginPathFor(location)} size="sm">
        Sign in
      </Button>
    </div>
  );
};
