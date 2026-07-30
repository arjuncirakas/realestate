import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Map } from '@vis.gl/react-google-maps';
import { PropertyGrid } from './PropertyGrid.jsx';

/**
 * `Map` is the one thing Section 7.3 forbids in a grid of cards — mocking it
 * lets the tests below assert it is never constructed, which is the
 * regression guard the work package calls for: a grid of cards must open
 * zero interactive map instances, no matter how many cards it holds.
 */
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }) => children,
  Map: vi.fn(() => null),
  Marker: vi.fn(() => null),
  createStaticMapsUrl: vi.fn(() => 'https://maps.googleapis.com/maps/api/staticmap?mocked=1'),
}));

/** A `PropertyListItemSchema`-shaped fixture, so cards render every field. */
const makeProperty = (overrides = {}) => ({
  id: overrides.id ?? 'p1',
  slug: overrides.slug ?? 'eight-cent-plot-near-kottiyam-junction',
  title: 'Eight cent plot near Kottiyam junction',
  propertyType: 'PLOT',
  status: 'AVAILABLE',
  price: '3900000',
  priceIsNegotiable: true,
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
  ...overrides,
});

const renderGrid = (result) => render(<PropertyGrid result={result} />, { wrapper: MemoryRouter });

const PENDING = { data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn(), validationError: null };
const ERROR = {
  data: undefined,
  isPending: false,
  isError: true,
  error: { message: 'Could not reach the server. Check your connection and try again.' },
  refetch: vi.fn(),
  validationError: null,
};
const EMPTY = {
  data: { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  validationError: null,
};

describe('PropertyGrid', () => {
  it('shows a loading skeleton, not a bare spinner, while pending', () => {
    renderGrid(PENDING);
    expect(screen.getByRole('status', { name: 'Loading plots' })).toBeInTheDocument();
  });

  it('shows the error state with a retry that calls refetch', async () => {
    const user = userEvent.setup();
    renderGrid(ERROR);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(ERROR.error.message)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(ERROR.refetch).toHaveBeenCalledOnce();
  });

  it('shows an instructive empty state rather than an apology', () => {
    renderGrid(EMPTY);
    expect(screen.getByText('No plots match these filters')).toBeInTheDocument();
    expect(screen.getByText(/Widen the price range or clear a filter/)).toBeInTheDocument();
  });

  it("surfaces the contract schema's own message for a filter combination it rejects", () => {
    renderGrid({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      validationError: { issues: [{ message: 'Minimum price cannot exceed maximum price' }] },
    });

    expect(screen.getByText('Minimum price cannot exceed maximum price')).toBeInTheDocument();
  });

  it('renders a card per plot on success, with the price as the loudest text', () => {
    const properties = [
      makeProperty({ id: 'p1', slug: 'plot-one', price: '3900000' }),
      makeProperty({ id: 'p2', slug: 'plot-two', price: '5800000' }),
    ];
    renderGrid({
      data: { items: properties, meta: { page: 1, limit: 20, total: 2, totalPages: 1 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      validationError: null,
    });

    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText('₹39 lakh')).toBeInTheDocument();
    expect(screen.getByText('₹58 lakh')).toBeInTheDocument();
  });

  it('opens zero interactive map instances for a grid of cards', () => {
    const properties = Array.from({ length: 6 }, (_, index) =>
      makeProperty({ id: `p${index}`, slug: `plot-${index}` }),
    );

    renderGrid({
      data: { items: properties, meta: { page: 1, limit: 20, total: 6, totalPages: 1 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      validationError: null,
    });

    expect(screen.getAllByRole('link')).toHaveLength(6);
    // The regression this guards (Section 7.3): a card grid uses the Static
    // Maps API only. Twenty interactive maps on one page is roughly twenty
    // times the intended cost of that page.
    expect(Map).not.toHaveBeenCalled();
  });
});
