import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import { RegisterInterestForm } from './RegisterInterestForm.jsx';

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

/**
 * Proves `RegisterInterestForm` requires a session, enforces
 * `InterestCreateSchema` from the contract, posts to the right property, and
 * never renders any of the Section 1.3 prohibited vocabulary.
 */

const AUTHENTICATED_AUTH = {
  user: { id: 'u1', fullName: 'Meera Krishnan', email: 'meera@example.test', phone: null },
  status: 'authenticated',
  isAuthenticated: true,
  hasRole: () => true,
  isAgent: false,
  isAdmin: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

const GUEST_AUTH = { ...AUTHENTICATED_AUTH, user: null, status: 'anonymous', isAuthenticated: false };

const PROPERTY_ID = 'prop-9';

function renderForm(authValue, props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <RegisterInterestForm propertyId={PROPERTY_ID} {...props} />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterInterestForm', () => {
  it('prompts a signed-out visitor to sign in, instead of showing the form', () => {
    renderForm(GUEST_AUTH);

    expect(screen.getByText(/Sign in to register your interest/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Indicative amount/)).not.toBeInTheDocument();
  });

  it('rejects an indicative amount of zero, using the contract message', async () => {
    const user = userEvent.setup();
    renderForm(AUTHENTICATED_AUTH);

    await user.type(screen.getByLabelText(/Indicative amount/), '0');
    await user.click(screen.getByRole('button', { name: 'Register interest' }));

    expect(await screen.findByText('Must be greater than zero')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('registers interest for the right property, omitting blank optional fields', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    api.post.mockResolvedValueOnce({ data: { data: { id: 'interest-1' } } });

    renderForm(AUTHENTICATED_AUTH, { onSuccess });
    await user.click(screen.getByRole('button', { name: 'Register interest' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Vitest's equality treats explicit-undefined keys as absent, matching what
    // axios actually sends once JSON.stringify drops them.
    expect(api.post).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/interest`, {});
  });

  it('never renders any of the prohibited Section 1.3 vocabulary', () => {
    const { container } = renderForm(AUTHENTICATED_AUTH);
    const text = container.textContent.toLowerCase();

    for (const banned of ['invest', 'investor', 'shares', 'dividend', 'yield', 'roi', 'appreciation']) {
      expect(text).not.toContain(banned);
    }
  });
});
