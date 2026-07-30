import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import { EnquiryForm } from './EnquiryForm.jsx';

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

/**
 * Proves `EnquiryForm` works signed-out (the endpoint is public — Section
 * 5.2), enforces `EnquiryCreateSchema` from the contract rather than a local
 * rule, and posts to the right property.
 */

const GUEST_AUTH = {
  user: null,
  status: 'anonymous',
  isAuthenticated: false,
  hasRole: () => false,
  isAgent: false,
  isAdmin: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

const PROPERTY_ID = '11111111-1111-1111-1111-111111111111';

function renderForm(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={GUEST_AUTH}>
        <EnquiryForm propertyId={PROPERTY_ID} {...props} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('EnquiryForm', () => {
  it('rejects a message shorter than the contract minimum, using its message', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Your name/), 'Arun Nair');
    await user.type(screen.getByLabelText(/Email/), 'arun@example.test');
    await user.type(screen.getByLabelText(/Message/), 'Too short');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(
      await screen.findByText('Tell us a little more — at least 10 characters'),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Your name/), 'Arun Nair');
    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(
      screen.getByLabelText(/Message/),
      'I would like to know more about this plot.',
    );
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends the enquiry to the right property and calls onSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    api.post.mockResolvedValueOnce({ data: { data: { id: 'enq-1' } } });

    renderForm({ onSuccess });

    await user.type(screen.getByLabelText(/Your name/), 'Arun Nair');
    await user.type(screen.getByLabelText(/Email/), 'arun@example.test');
    await user.type(
      screen.getByLabelText(/Message/),
      'I would like to know more about this plot.',
    );
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/enquiries`, {
      name: 'Arun Nair',
      email: 'arun@example.test',
      message: 'I would like to know more about this plot.',
    });
  });
});
