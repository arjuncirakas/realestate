import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import AdminPropertiesPage from './AdminPropertiesPage.jsx';

/**
 * Proves the admin-only "Withdraw listing" control (`DELETE /properties/:id`,
 * Section 5.3) is gated on `useAuth().isAdmin` — hidden from an agent, shown
 * to an admin. The endpoint itself is the real boundary; this is the courtesy
 * gate the work package asks for on top of it.
 */

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

const AGENT_AUTH = {
  user: { id: 'agent-1', fullName: 'Anil Kumar', role: 'AGENT' },
  status: 'authenticated',
  isAuthenticated: true,
  hasRole: () => true,
  isAgent: true,
  isAdmin: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

const ADMIN_AUTH = { ...AGENT_AUTH, user: { ...AGENT_AUTH.user, role: 'ADMIN' }, isAdmin: true };

const LISTING_ROW = {
  id: 'prop-1',
  slug: 'kottiyam-plot',
  title: 'Eight cent plot near Kottiyam junction',
  propertyType: 'PLOT',
  status: 'AVAILABLE',
  price: '3900000',
  priceIsNegotiable: false,
  areaValue: '8',
  areaUnit: 'CENT',
  locality: 'Kottiyam',
  city: 'Kollam',
  district: 'Kollam',
  state: 'Kerala',
  surveyNumber: '64/3',
  latitude: 8.848,
  longitude: 76.706,
  isGroupPurchase: false,
  coverImageUrl: null,
  publishedAt: '2026-01-12T00:00:00.000Z',
  createdAt: '2026-01-05T09:00:00.000Z',
};

const renderPage = (authValue) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  api.get.mockResolvedValue({
    data: { data: [LISTING_ROW], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <AdminPropertiesPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('AdminPropertiesPage', () => {
  it('hides "Withdraw listing" from an agent', async () => {
    renderPage(AGENT_AUTH);

    await screen.findByText('Eight cent plot near Kottiyam junction');
    expect(screen.queryByRole('button', { name: 'Withdraw listing' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows "Withdraw listing" to an admin', async () => {
    renderPage(ADMIN_AUTH);

    await screen.findByText('Eight cent plot near Kottiyam junction');
    expect(screen.getByRole('button', { name: 'Withdraw listing' })).toBeInTheDocument();
  });
});
