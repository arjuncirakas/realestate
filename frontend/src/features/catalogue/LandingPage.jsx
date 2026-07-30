import { Link } from 'react-router-dom';
import { ClipboardList, MapPinned, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/index.js';
import { PropertyGrid } from '@/components/property/index.js';
import { usePropertiesList } from '@/api/properties.js';
import { buildPath, ROUTES } from '@/routes/paths.js';

const FEATURED_FILTERS = Object.freeze({ sort: 'newest', limit: '3' });

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Browse the record',
    body: 'Every listing carries its survey number, measured area and locality, so you can check it against your own paperwork before you enquire.',
  },
  {
    icon: ClipboardList,
    title: 'Enquire or request a site visit',
    body: 'Ask a question or book a visit directly from a listing. The agency replies from its own queue, not an automated form response.',
  },
  {
    icon: MapPinned,
    title: 'Verify on the ground',
    body: 'A site visit and the agency’s own document checks happen before anything is agreed — nothing here is a binding step on its own.',
  },
];

/**
 * The public landing page: hero, featured plots, how it works, and a short
 * group-purchase teaser (Section 7.1). The full group-purchase catalogue and
 * its register-interest flow are WP11's `/group-purchase` route — this is a
 * link and a paragraph, not a second copy of that feature.
 *
 * @returns {import('react').ReactElement}
 */
export default function LandingPage() {
  const featuredResult = usePropertiesList(FEATURED_FILTERS);

  return (
    <div>
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-16 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
            Thiruvananthapuram · Kollam · Alappuzha
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold text-ink sm:text-4xl">
            Land and plot records you can check against your own paperwork
          </h1>
          <p className="max-w-2xl text-ink-muted">
            Every listing here is documented like a registry entry, not a marketing brochure —
            survey number, exact area and location included, before you ever speak to an agent.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button as={Link} to={ROUTES.properties}>
              Browse plots
            </Button>
            <Button as={Link} to={ROUTES.groupPurchase} variant="secondary">
              See group purchase opportunities
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl text-ink">Recently listed</h2>
            <p className="mt-1 text-sm text-ink-muted">The latest plots added to the record.</p>
          </div>
          <Link to={ROUTES.properties} className="text-sm text-moss hover:text-moss-dark">
            View all plots
          </Link>
        </div>
        <PropertyGrid
          result={featuredResult}
          skeletonCount={3}
          emptyTitle="No plots listed yet"
          emptyInstruction="Check back shortly — new listings are added regularly."
          className="sm:grid-cols-3"
        />
      </section>

      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-2xl text-ink">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-card border border-hairline bg-parchment p-4">
                <Icon className="size-5 text-moss" aria-hidden="true" />
                <p className="mt-3 text-base font-semibold text-ink">{title}</p>
                <p className="mt-1.5 text-sm text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-6 shrink-0 text-clay" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-ink">Group purchase opportunities</p>
              <p className="mt-1 max-w-xl text-sm text-ink-muted">
                A short list of larger plots where several buyers can register interest together.
                Registering interest is an enquiry, not a payment or a commitment — the agency
                contacts you to discuss next steps.
              </p>
            </div>
          </div>
          <Button as={Link} to={buildPath(ROUTES.groupPurchase)} variant="secondary" className="shrink-0">
            Register your interest
          </Button>
        </div>
      </section>
    </div>
  );
}
