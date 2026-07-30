import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/api/client.js';
import { AuthContext } from '@/features/auth/auth-context.js';
import PropertyRecordPage from './PropertyRecordPage.jsx';

/**
 * Proves the detail page's loading/error states and, most importantly, the
 * co-owner share display: `ownerships` on the response is every share on the
 * plot, not just the caller's own row, and the caller's row is marked "You".
 */

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

const AUTH_VALUE = {
  user: { id: 'user-meera', fullName: 'Meera Krishnan', email: 'meera@example.test', phone: null },
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

const PROPERTY = {
  id: 'prop-mararikulam',
  slug: 'mararikulam-beach-belt-16-cent',
  title: 'Mararikulam beach belt, 16 cent',
  propertyType: 'PLOT',
  status: 'AVAILABLE',
  price: '11000000',
  priceIsNegotiable: false,
  areaValue: '16',
  areaUnit: 'CENT',
  locality: 'Mararikulam',
  city: 'Alappuzha',
  district: 'Alappuzha',
  state: 'Kerala',
  surveyNumber: '88/2',
  latitude: 9.5,
  longitude: 76.3,
  isGroupPurchase: false,
  coverImageUrl: null,
  publishedAt: '2025-06-01T00:00:00.000Z',
  createdAt: '2025-05-20T00:00:00.000Z',
  description: null,
  addressLine: null,
  pincode: null,
  amenities: [],
  groupTargetAmount: null,
  groupMinTicket: null,
  listedByAgentId: 'agent-1',
  listedByAgent: { id: 'agent-1', fullName: 'Ravi Nair', email: 'ravi@example.test' },
  viewCount: 12,
  media: [],
  updatedAt: '2025-06-01T00:00:00.000Z',
};

const MY_OWNERSHIP = {
  id: 'own-meera',
  propertyId: PROPERTY.id,
  ownerUserId: 'user-meera',
  ownerUser: { id: 'user-meera', fullName: 'Meera Krishnan', email: 'meera@example.test' },
  // Unpadded, as Prisma's `Decimal#toString()` actually sends it (`docs/API.md` §3).
  sharePercentage: '40',
  registeredOn: '2025-05-25',
  documentRef: 'DOC-77',
  notes: null,
  createdAt: '2025-05-25T00:00:00.000Z',
  updatedAt: '2025-05-25T00:00:00.000Z',
};

const CO_OWNERSHIP = {
  id: 'own-joseph',
  propertyId: PROPERTY.id,
  ownerUserId: 'user-joseph',
  ownerUser: { id: 'user-joseph', fullName: 'Joseph Thomas', email: 'joseph@example.test' },
  sharePercentage: '60',
  registeredOn: '2025-05-25',
  documentRef: 'DOC-78',
  notes: null,
  createdAt: '2025-05-25T00:00:00.000Z',
  updatedAt: '2025-05-25T00:00:00.000Z',
};

const EMPTY_PAGE = (limit) => ({ page: 1, limit, total: 0, totalPages: 0 });

const mockJointDetail = () => {
  api.get.mockImplementation((url) => {
    if (url === `/me/properties/${PROPERTY.id}`) {
      return Promise.resolve({
        data: { data: { property: PROPERTY, ownership: MY_OWNERSHIP, ownerships: [MY_OWNERSHIP, CO_OWNERSHIP] } },
      });
    }
    if (url === `/me/properties/${PROPERTY.id}/logs`) {
      return Promise.resolve({ data: { data: [], meta: EMPTY_PAGE(10) } });
    }
    if (url === `/me/properties/${PROPERTY.id}/snapshots`) {
      return Promise.resolve({ data: { data: [], meta: EMPTY_PAGE(12) } });
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  });
};

function renderPage(authValue = AUTH_VALUE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[`/dashboard/my-properties/${PROPERTY.id}`]}>
          <Routes>
            <Route path="/dashboard/my-properties/:id" element={<PropertyRecordPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('PropertyRecordPage', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('shows a loading skeleton while the record is pending', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.queryByText(PROPERTY.title)).not.toBeInTheDocument();
  });

  it('shows the error state when the record fails to load', async () => {
    api.get.mockRejectedValue({ message: 'That did not load. Try again shortly.' });
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This ownership record did not load')).toBeInTheDocument();
  });

  it("renders every co-owner's share, marking only the caller's own row as You", async () => {
    mockJointDetail();
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mararikulam beach belt, 16 cent' }),
    ).toBeInTheDocument();

    // Every share on the plot, per the co-owner table — not only the caller's.
    expect(screen.getByText('Meera Krishnan')).toBeInTheDocument();
    expect(screen.getByText('Joseph Thomas')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    // The caller's own ownership card and the shares table both read the
    // same trimmed value, from the unpadded API shape ("40" -> "40%", not
    // "4%" — the regression this test exists to catch).
    expect(screen.getAllByText('40%')).toHaveLength(2);

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Allocated so far:')).toBeInTheDocument();
  });
});
