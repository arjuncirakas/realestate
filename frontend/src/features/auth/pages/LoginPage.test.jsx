import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import LoginPage from './LoginPage.jsx';

/**
 * Builds a session value for the page to read, bypassing `AuthProvider` so a
 * test can pin `login` to a specific outcome without a network call. Mirrors
 * the pattern in `routes/guards.test.jsx`.
 * @param {{ status?: string, login?: import('vitest').Mock }} args
 * @returns {object}
 */
const authValue = ({ status = 'anonymous', login = vi.fn() } = {}) => ({
  user: null,
  status,
  isAuthenticated: status === 'authenticated',
  login,
  register: vi.fn(),
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
const renderLogin = ({ value, initialEntry = '/login' }) =>
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>Dashboard landing</p>} />
          <Route path="/dashboard/saved" element={<p>Saved plots landing</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('LoginPage', () => {
  it('shows the contract validation messages for an empty submission', async () => {
    const user = userEvent.setup();
    renderLogin({ value: authValue() });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
  });

  it('signs in and returns to the safe next path', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ id: 'u1' });
    renderLogin({ value: authValue({ login }), initialEntry: '/login?next=%2Fdashboard%2Fsaved' });

    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith({ email: 'meera@example.test', password: 'Password123' });
    expect(await screen.findByText('Saved plots landing')).toBeInTheDocument();
  });

  it('ignores an unsafe next value and falls back to the dashboard', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ id: 'u1' });
    renderLogin({
      value: authValue({ login }),
      initialEntry: `/login?next=${encodeURIComponent('//evil.example')}`,
    });

    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard landing')).toBeInTheDocument();
  });

  it('shows a banner for invalid credentials, since the server attaches no field detail', async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ code: 'UNAUTHENTICATED', status: 401, message: 'Invalid email or password.' }),
      );
    renderLogin({ value: authValue({ login }) });

    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Could not sign in')).toBeInTheDocument();
    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('names rate limiting clearly rather than as a generic failure', async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ code: 'RATE_LIMITED', status: 429, message: 'Too many requests. Wait a few minutes and try again.' }),
      );
    renderLogin({ value: authValue({ login }) });

    await user.type(screen.getByLabelText(/Email/), 'meera@example.test');
    await user.type(screen.getByLabelText(/Password/), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Too many attempts')).toBeInTheDocument();
  });

  it('redirects a signed-in user away rather than showing the form', () => {
    renderLogin({ value: authValue({ status: 'authenticated' }) });

    expect(screen.getByText('Dashboard landing')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument();
  });
});
