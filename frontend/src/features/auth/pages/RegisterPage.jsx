import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardBody, CardFooter, CardHeader, ErrorState, Input } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { RegisterSchema } from '@/contracts/index.js';
import { ROUTES } from '@/routes/paths.js';
import { safeNextPath } from '@/routes/next-path.js';
import { RouteLoading } from '@/routes/RouteLoading.jsx';
import { applyFormError, bannerCopy } from './auth-error.js';

/** Fields checked, in order, for a server-side detail from `/auth/register`. */
const SERVER_ERROR_FIELDS = ['email', 'password', 'fullName', 'phone'];

/**
 * An empty text input still reaches `react-hook-form` as `''`, not
 * `undefined`, so `PhoneSchema.optional()` would reject a blank, unfilled
 * field instead of skipping it. Converting `''` to `undefined` here — rather
 * than in the contract — keeps the optional rule itself untouched.
 * @param {string} value
 * @returns {string | undefined}
 */
const blankToUndefined = (value) => (value === '' ? undefined : value);

/**
 * `/register` (Section 7.1) — creates a subscriber account and signs the
 * visitor in, then honours the `?next=` round trip via `safeNextPath`.
 *
 * @returns {import('react').ReactElement}
 */
export default function RegisterPage() {
  const { status, isAuthenticated, register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(RegisterSchema) });

  if (status === 'checking') return <RouteLoading />;

  if (isAuthenticated) {
    return <Navigate to={safeNextPath(searchParams.get('next'))} replace />;
  }

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await createAccount(values);
      navigate(safeNextPath(searchParams.get('next')), { replace: true });
    } catch (error) {
      setFormError(applyFormError(error, setError, SERVER_ERROR_FIELDS));
    }
  };

  const copy = formError ? bannerCopy(formError, 'create the account') : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Card>
        <CardHeader
          title="Create account"
          description="Save plots, book site visits and register interest in group purchase opportunities."
        />
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardBody className="flex flex-col gap-4">
            {formError && (
              <ErrorState title={copy.title} error={formError} instruction={copy.instruction} />
            )}

            <Input
              label="Full name"
              autoComplete="name"
              required
              error={errors.fullName?.message}
              {...register('fullName')}
            />
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
              autoComplete="new-password"
              hint="At least 8 characters, with a letter and a number."
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              hint="Optional. Used only if the agency needs to reach you quickly."
              error={errors.phone?.message}
              {...register('phone', { setValueAs: blankToUndefined })}
            />
          </CardBody>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" loading={isSubmitting} fullWidth>
              Create account
            </Button>
            <p className="text-center text-sm text-ink-muted">
              Already have an account?{' '}
              <Link to={ROUTES.login} className="text-moss underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
