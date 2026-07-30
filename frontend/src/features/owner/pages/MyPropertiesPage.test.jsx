import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Map } from '@vis.gl/react-google-maps';
import { api } from '@/api/client.js';
import MyPropertiesPage from './MyPropertiesPage.jsx';

/**
 * Proves the four required list states (Section 9.3), the share badge reads
 * off `sharePercentage` without `parseFloat`, and that a grid of owned plots
 * never opens an interactive map instance (Section 7.3) — the list has no
 * coordinates to plot in the first place (`PropertySummarySchema` carries
 * none), so this is the same regression guard `PropertyGrid.test.jsx` uses
 * for the catalogue grid.
 */

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }) => children,
  Map: vi.fn(() => null),
  Marker: vi.fn(() => null),
  createStaticMapsUrl: vi.fn(() => 'https://maps.googleapis.com/maps/api/staticmap?mocked=1'),
}));

const makeItem = (overrides = {}) => ({
  property: {
    id: 'prop-1',
    slug: 'kovalam-beach-road-12-cent',
    title: 'Kovalam beach road, 12 cent',
    status: 'AVAILABLE',
    price: '9500000',
    areaValue: '12',
    areaUnit: 'CENT',
    locality: 'Kovalam',
    city: 'Thiruvananthapuram',
    surveyNumber: '112/4',
    coverImageUrl: null,
    ...overrides.property,
  },
  ownership: {
    id: 'own-1',
    propertyId: 'prop-1',
    ownerUserId: 'user-1',
    ownerUser: { id: 'user-1', fullName: 'Meera Krishnan', email: 'meera@example.test' },
    // Unpadded, as Prisma's `Decimal#toString()` actually sends it
    // (`docs/API.md` §3) — not `"100.00"`.
    sharePercentage: '100',
    registeredOn: '2025-01-10',
    documentRef: 'DOC-1',
    notes: null,
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z',
    ...overrides.ownership,
  },
});

const PAGE_META = (total) => ({ page: 1, limit: 20, total, totalPages: total > 0 ? 1 : 0 });

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyPropertiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyPropertiesPage', () => {
  // Call counts on `api.get` are asserted per test, so each one starts clean.
  beforeEach(() => {
    api.get.mockReset();
  });

  it('shows a loading skeleton, not a bare spinner, while pending', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading your plots' })).toBeInTheDocument();
  });

  it('shows the error state and retries through the query, not a fresh mount', async () => {
    const user = userEvent.setup();
    api.get.mockRejectedValueOnce({
      message: 'Could not reach the server. Check your connection and try again.',
    });
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('Could not reach the server. Check your connection and try again.'),
    ).toBeInTheDocument();

    api.get.mockResolvedValueOnce({ data: { data: [], meta: PAGE_META(0) } });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('shows an instructive empty state rather than an apology', async () => {
    api.get.mockResolvedValueOnce({ data: { data: [], meta: PAGE_META(0) } });
    renderPage();

    expect(await screen.findByText('No plots recorded against your account yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'If you have bought through the agency, contact the office and they will add the record.',
      ),
    ).toBeInTheDocument();
  });

  it('renders a card per owned plot with its share, and opens zero interactive maps', async () => {
    const items = [
      makeItem(),
      makeItem({
        property: {
          id: 'prop-2',
          slug: 'mararikulam-beach-belt-16-cent',
          title: 'Mararikulam beach belt, 16 cent',
        },
        ownership: { id: 'own-2', propertyId: 'prop-2', sharePercentage: '40' },
      }),
    ];
    api.get.mockResolvedValueOnce({ data: { data: items, meta: PAGE_META(2) } });
    renderPage();

    expect(await screen.findByText('Kovalam beach road, 12 cent')).toBeInTheDocument();
    expect(screen.getByText('Mararikulam beach belt, 16 cent')).toBeInTheDocument();
    // Unpadded API values ("100", "40") must render as whole percentages, not
    // have a trailing digit eaten as if it were decimal padding.
    expect(screen.getByText('Your share: 100%')).toBeInTheDocument();
    expect(screen.getByText('Your share: 40%')).toBeInTheDocument();

    // Section 7.3: a grid of plot cards uses the Static Maps API only.
    expect(Map).not.toHaveBeenCalled();
  });
});
