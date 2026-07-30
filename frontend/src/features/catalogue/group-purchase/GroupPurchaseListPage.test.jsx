import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import GroupPurchaseListPage from './GroupPurchaseListPage.jsx';

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

/**
 * Proves `/group-purchase` carries all four required list states (Section
 * 9.3) and always sends `groupPurchaseOnly: true` to the shared catalogue
 * endpoint — there is no dedicated group-purchase endpoint to filter on the
 * server's behalf otherwise.
 */

const PROPERTY = {
  id: 'p1',
  slug: 'nedumangad-garden-land-1-acre',
  title: 'Nedumangad garden land, 1 acre',
  propertyType: 'FARMLAND',
  status: 'AVAILABLE',
  price: '9500000',
  priceIsNegotiable: false,
  areaValue: '1',
  areaUnit: 'ACRE',
  locality: 'Nedumangad',
  city: 'Thiruvananthapuram',
  district: 'Thiruvananthapuram',
  state: 'Kerala',
  surveyNumber: '112/4',
  latitude: 8.604,
  longitude: 77.005,
  isGroupPurchase: true,
  coverImageUrl: null,
  publishedAt: '2026-02-01T00:00:00.000Z',
  createdAt: '2026-01-28T09:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/group-purchase']}>
        <GroupPurchaseListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GroupPurchaseListPage', () => {
  it('shows a loading skeleton, not a bare spinner, while pending', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading plots' })).toBeInTheDocument();
  });

  it('shows the error state with a retry action on failure', async () => {
    api.get.mockRejectedValueOnce({ response: undefined, code: undefined });
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows an instructive empty state when there are no opportunities', async () => {
    api.get.mockResolvedValueOnce({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });
    renderPage();

    expect(await screen.findByText('No group purchase opportunities right now')).toBeInTheDocument();
    expect(screen.getByText(/browse the full catalogue/)).toBeInTheDocument();
  });

  it('renders a card per opportunity on success, requesting groupPurchaseOnly', async () => {
    api.get.mockResolvedValueOnce({
      data: { data: [PROPERTY], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });
    renderPage();

    expect(await screen.findByRole('link', { name: /Nedumangad garden land/ })).toBeInTheDocument();
    expect(screen.getByText('1 opportunity on record')).toBeInTheDocument();

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/properties',
        expect.objectContaining({ params: expect.objectContaining({ groupPurchaseOnly: true }) }),
      ),
    );
  });
});
