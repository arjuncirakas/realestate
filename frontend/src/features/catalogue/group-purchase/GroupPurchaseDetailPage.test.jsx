import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import GroupPurchaseDetailPage from './GroupPurchaseDetailPage.jsx';

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

/**
 * Proves `/group-purchase/:slug` renders `groupTargetAmount` and
 * `groupMinTicket` as plain labelled figures — never a fill bar, a percentage
 * complete, or a countdown (Section 1.3) — and embeds the shared
 * `RegisterInterestForm` rather than a second interest form.
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

const PROPERTY = {
  id: 'p1',
  slug: 'nedumangad-garden-land-1-acre',
  title: 'Nedumangad garden land, 1 acre',
  propertyType: 'FARMLAND',
  status: 'AVAILABLE',
  price: '10500000',
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
  description: 'A quiet acre bordering a working paddy field.',
  addressLine: null,
  pincode: '695588',
  amenities: [],
  groupTargetAmount: '9500000',
  groupMinTicket: '950000',
  listedByAgentId: null,
  listedByAgent: null,
  viewCount: 12,
  media: [],
  updatedAt: '2026-02-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={GUEST_AUTH}>
        <MemoryRouter initialEntries={[`/group-purchase/${PROPERTY.slug}`]}>
          <Routes>
            <Route path="/group-purchase/:slug" element={<GroupPurchaseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('GroupPurchaseDetailPage', () => {
  it('shows a loading skeleton while pending', () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    const { container } = renderPage();

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows the error state with a retry action on failure', async () => {
    api.get.mockRejectedValueOnce({ response: undefined, code: undefined });
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders the indicative figures as plain values, with no progress or countdown device', async () => {
    api.get.mockResolvedValueOnce({ data: { data: PROPERTY } });
    renderPage();

    expect(await screen.findByText('Indicative total')).toBeInTheDocument();
    expect(screen.getByText('₹95 lakh')).toBeInTheDocument();
    expect(screen.getByText('Indicative minimum contribution')).toBeInTheDocument();
    expect(screen.getByText('₹9.5 lakh')).toBeInTheDocument();

    // No progress bar, meter, or percentage-complete device anywhere on the page.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(document.querySelector('progress, meter')).not.toBeInTheDocument();
  });

  it('embeds the shared register-interest form rather than a second one', async () => {
    api.get.mockResolvedValueOnce({ data: { data: PROPERTY } });
    renderPage();

    expect(await screen.findByText(/Sign in to register your interest/)).toBeInTheDocument();
  });
});
