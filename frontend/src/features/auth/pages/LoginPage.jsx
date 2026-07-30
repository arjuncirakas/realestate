import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardBody, CardFooter, CardHeader, ErrorState, Input } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { LoginSchema } from '@/contracts/index.js';
import { ROUTES } from '@/routes/paths.js';
import { safeNextPath } from '@/routes/next-path.js';
import { RouteLoading } from '@/routes/RouteLoading.jsx';
import { applyFormError, bannerCopy } from './auth-error.js';

/** Fields checked, in order, for a server-side detail from `/auth/login`. */
const SERVER_ERROR_FIELDS = ['email', 'password'];

/**
 * `/login` (Section 7.1).
 *
 * Honours the `?next=` round trip via `safeNextPath` — never navigates on the
 * raw query value, since the pinned react-router carries an open-redirect
 * advisory (GHSA-wrjc-x8rr-h8h6) with no fix in the v6 line.
 *
 * @returns {import('react').ReactElement}
 */
export default function LoginPage() {
  const { status, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(LoginSchema) });

  if (status === 'checking') return <RouteLoading />;

  // A signed-in user has no business on a form asking them to sign in again.
  if (isAuthenticated) {
    return <Navigate to={safeNextPath(searchParams.get('next'))} replace />;
  }

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await login(values);
      navigate(safeNextPath(searchParams.get('next')), { replace: true });
    } catch (error) {
      setFormError(applyFormError(error, setError, SERVER_ERROR_FIELDS));
    }
  };

  const copy = formError ? bannerCopy(formError, 'sign in') : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Card>
        <CardHeader
          title="Sign in"
          description="Access your saved plots, visit requests and registered interests."
        />
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardBody className="flex flex-col gap-4">
            {formError && (
              <ErrorState title={copy.title} error={formError} instruction={copy.instruction} />
            )}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />
          </CardBody>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" loading={isSubmitting} fullWidth>
              Sign in
            </Button>
            <p className="text-center text-sm text-ink-muted">
              New here?{' '}
              <Link to={ROUTES.register} className="text-moss underline underline-offset-2">
                Create an account
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
