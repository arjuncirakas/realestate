import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import { SiteVisitForm } from './SiteVisitForm.jsx';

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

/**
 * Proves `SiteVisitForm` requires a session, enforces
 * `SiteVisitCreateSchema` from the contract, and posts to the right property.
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

const PROPERTY_ID = 'prop-1';

function renderForm(authValue, props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SiteVisitForm propertyId={PROPERTY_ID} {...props} />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SiteVisitForm', () => {
  it('prompts a signed-out visitor to sign in, instead of showing the form', () => {
    renderForm(GUEST_AUTH);

    expect(screen.getByText(/Sign in to request a site visit/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Preferred date/)).not.toBeInTheDocument();
  });

  it('requires a preferred date, using the contract message', async () => {
    const user = userEvent.setup();
    renderForm(AUTHENTICATED_AUTH);

    await user.click(screen.getByRole('button', { name: 'Request site visit' }));

    expect(await screen.findByText('Must be a date in YYYY-MM-DD form')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('requests a visit for the right property with the chosen date and slot', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    api.post.mockResolvedValueOnce({ data: { data: { id: 'visit-1' } } });

    renderForm(AUTHENTICATED_AUTH, { onSuccess });

    fireEvent.change(screen.getByLabelText(/Preferred date/), {
      target: { value: '2026-09-01' },
    });
    await user.selectOptions(screen.getByLabelText(/Preferred time of day/), 'AFTERNOON');
    await user.click(screen.getByRole('button', { name: 'Request site visit' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/site-visits`, {
      preferredDate: '2026-09-01',
      preferredSlot: 'AFTERNOON',
    });
  });
});
