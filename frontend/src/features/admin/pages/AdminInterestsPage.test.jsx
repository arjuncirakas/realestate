import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client.js';
import AdminInterestsPage from './AdminInterestsPage.jsx';

/**
 * Proves the agent follow-up queue's status transition (Section 5.2,
 * `PATCH /interests/:id`): opening the manage panel, changing the status and
 * saving sends exactly the patch the contract expects, and the row reflects
 * the queue's own compliant vocabulary (Section 1.3) rather than anything
 * this page invents.
 */

vi.mock('@/api/client.js', async () => {
  const actual = await vi.importActual('@/api/client.js');
  return { ...actual, api: { ...actual.api, get: vi.fn(), patch: vi.fn() } };
});

// jsdom (as of the version this project pins) implements the `<dialog>`
// element but not `showModal`/`close` (https://github.com/jsdom/jsdom/issues/3294).
// `Modal` (WP0.5, `components/ui/Modal.jsx`) relies on both, so opening it in
// a test needs this stand-in — scoped to this file rather than the shared
// `lib/test-setup.js`, which is outside this work package's owned paths.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
});

const INTEREST_ROW = {
  id: 'interest-1',
  propertyId: 'prop-1',
  userId: 'user-1',
  indicativeAmount: '1200000',
  notes: 'Would like to join with two family members.',
  status: 'NEW',
  agentNotes: null,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
  property: {
    id: 'prop-1',
    slug: 'kottiyam-group-plot',
    title: 'Kottiyam group purchase plot',
    status: 'AVAILABLE',
    price: '9000000',
    areaValue: '40',
    areaUnit: 'CENT',
    locality: 'Kottiyam',
    city: 'Kollam',
    surveyNumber: '12/4',
    coverImageUrl: null,
  },
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminInterestsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('AdminInterestsPage', () => {
  it('sends the status transition, plus trimmed notes, in one patch', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({
      data: { data: [INTEREST_ROW], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });
    api.patch.mockResolvedValueOnce({ data: { data: { ...INTEREST_ROW, status: 'CONTACTED' } } });

    renderPage();

    await screen.findByText('Kottiyam group purchase plot');
    await user.click(screen.getByRole('button', { name: 'Manage' }));

    const modal = await screen.findByRole('dialog', { name: 'Manage registered interest' });
    await user.selectOptions(within(modal).getByLabelText('Status'), 'CONTACTED');
    await user.type(within(modal).getByLabelText(/Agency notes/), 'Called, following up next week.');
    await user.click(within(modal).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/interests/interest-1', {
        status: 'CONTACTED',
        agentNotes: 'Called, following up next week.',
      }),
    );
  });

  it("keeps the row inside Section 1.3's approved vocabulary", async () => {
    api.get.mockResolvedValueOnce({
      data: { data: [INTEREST_ROW], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    renderPage();

    const row = await screen.findByRole('row', { name: /Kottiyam group purchase plot/ });
    expect(within(row).getByText('New')).toBeInTheDocument();

    const banned = ['invest', 'yield', 'return', 'dividend', 'portfolio'];
    for (const word of banned) {
      expect(document.body.textContent.toLowerCase()).not.toContain(word);
    }
  });
});
