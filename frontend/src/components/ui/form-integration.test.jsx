import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema } from '@/contracts/index.js';
import { Input } from './Input.jsx';
import { Button } from './Button.jsx';

/**
 * Proves the pattern every form in this project follows (Section 9.3): the
 * validation rules come from the shared contract schema, not from anything
 * restated in the component. If a rule were duplicated locally it could drift
 * from the backend; this asserts the contract is what is actually enforced.
 */
function RegisterFormProbe({ onValid }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(RegisterSchema) });

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Email" error={errors.email?.message} {...register('email')} />
      <Input
        label="Password"
        type="password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit">Create account</Button>
    </form>
  );
}

describe('a form driven by a contract schema', () => {
  it('rejects a password that has no number, using the contract message', async () => {
    const user = userEvent.setup();
    let submitted = null;

    render(<RegisterFormProbe onValid={(values) => (submitted = values)} />);

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // The wording comes from PasswordSchema in the contracts, not from here.
    expect(await screen.findByText('Password must contain a number')).toBeInTheDocument();
    expect(submitted).toBeNull();
  });

  it('rejects an invalid email', async () => {
    const user = userEvent.setup();
    render(<RegisterFormProbe onValid={() => undefined} />);

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('submits when every contract rule is satisfied, with the email normalised', async () => {
    const user = userEvent.setup();
    let submitted = null;

    render(<RegisterFormProbe onValid={(values) => (submitted = values)} />);

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'Meera@Example.TEST');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByRole('button', { name: 'Create account' });
    expect(submitted).toEqual({
      fullName: 'Meera Krishnan',
      // EmailSchema lowercases on the way in, so the form hands over the value
      // the backend will store.
      email: 'meera@example.test',
      password: 'Password123',
    });
  });

  it('associates each error with its input for assistive technology', async () => {
    const user = userEvent.setup();
    render(<RegisterFormProbe onValid={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const email = screen.getByLabelText(/Email/);
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    // aria-describedby must point at the visible error, not the hint.
    const describedBy = email.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy)).toHaveTextContent('Email is required');
  });
});
