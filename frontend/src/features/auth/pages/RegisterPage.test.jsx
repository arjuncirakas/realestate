import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import RegisterPage from './RegisterPage.jsx';

/**
 * @param {{ status?: string, register?: import('vitest').Mock }} args
 * @returns {object}
 */
const authValue = ({ status = 'anonymous', register = vi.fn() } = {}) => ({
  user: null,
  status,
  isAuthenticated: status === 'authenticated',
  login: vi.fn(),
  register,
  logout: vi.fn(),
  refresh: vi.fn(),
  hasRole: () => false,
  isAgent: false,
  isAdmin: false,
});

/**
 * @param {{ value: object, initialEntry?: string }} args
 * @returns {void}
 */
const renderRegister = ({ value, initialEntry = '/register' }) =>
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<p>Dashboard landing</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('RegisterPage', () => {
  it('shows the contract validation messages for an empty submission', async () => {
    const user = userEvent.setup();
    renderRegister({ value: authValue() });

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a name of at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('rejects a password with no number, using the contract message', async () => {
    const user = userEvent.setup();
    renderRegister({ value: authValue() });

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Password must contain a number')).toBeInTheDocument();
  });

  it('does not reject a blank optional phone field', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue({ id: 'u1' });
    renderRegister({ value: authValue({ register }) });

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByText('Dashboard landing');
    expect(register).toHaveBeenCalledWith({
      fullName: 'Meera Krishnan',
      email: 'meera@example.test',
      password: 'Password123',
      phone: undefined,
    });
  });

  it('creates the account and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue({ id: 'u1' });
    renderRegister({ value: authValue({ register }) });

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.type(screen.getByLabelText(/Phone/), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(register).toHaveBeenCalledWith({
      fullName: 'Meera Krishnan',
      email: 'meera@example.test',
      password: 'Password123',
      phone: '9876543210',
    });
    expect(await screen.findByText('Dashboard landing')).toBeInTheDocument();
  });

  it('routes a taken-email conflict onto the email field, not a generic banner', async () => {
    const user = userEvent.setup();
    const register = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          code: 'CONFLICT',
          status: 409,
          message: 'An account with that email already exists.',
        }),
      );
    renderRegister({ value: authValue({ register }) });

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const email = await screen.findByLabelText(/Email/);
    expect(await screen.findByText('An account with that email already exists.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Could not create the account')).not.toBeInTheDocument();
  });

  it('names rate limiting clearly rather than as a generic failure', async () => {
    const user = userEvent.setup();
    const register = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          code: 'RATE_LIMITED',
          status: 429,
          message: 'Too many requests. Wait a few minutes and try again.',
        }),
      );
    renderRegister({ value: authValue({ register }) });

    await user.type(screen.getByLabelText(/Full name/), 'Meera Krishnan');
    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Too many attempts')).toBeInTheDocument();
  });

  it('redirects a signed-in user away rather than showing the form', () => {
    renderRegister({ value: authValue({ status: 'authenticated' }) });

    expect(screen.getByText('Dashboard landing')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument();
  });
});
