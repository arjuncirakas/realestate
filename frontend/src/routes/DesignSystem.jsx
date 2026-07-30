import { useState } from 'react';
import { Bookmark, Inbox } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  PlotIdentityStrip,
  Select,
  Skeleton,
  SkeletonCardGrid,
  SkeletonTable,
  SkeletonText,
  Table,
  Textarea,
} from '@/components/ui/index.js';
import {
  ENQUIRY_STATUS_LABEL,
  ENQUIRY_STATUS_TONE,
  PROPERTY_STATUS_LABEL,
  PROPERTY_STATUS_TONE,
  PROPERTY_TYPE_LABEL,
  toSelectOptions,
} from '@/lib/labels.js';
import { formatArea, formatDate, formatDateTime, formatInr, formatInrExact, formatTimeAgo } from '@/lib/format.js';

/**
 * Dev-only gallery of every primitive, at the states a feature will actually use.
 *
 * It exists so a change to a primitive can be eyeballed in one place instead of
 * being discovered three features later, and so a teammate can see what already
 * exists before building a local variant. Not mounted in a production build.
 *
 * @returns {import('react').ReactElement}
 */
export default function DesignSystem() {
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(3);
  const [checked, setChecked] = useState(true);

  const rows = [
    { id: '1', plot: 'Ten cent plot near Technopark', survey: '142/3B', price: '5800000', area: '10', unit: 'CENT', status: 'AVAILABLE', locality: 'Kazhakkoottam' },
    { id: '2', plot: 'Two acre rubber holding at Vellanad', survey: '402/1', price: '14500000', area: '2', unit: 'ACRE', status: 'AVAILABLE', locality: 'Vellanad' },
    { id: '3', plot: 'Five cent plot in Punalur town', survey: '39/8', price: '2300000', area: '5', unit: 'CENT', status: 'UNDER_OFFER', locality: 'Punalur' },
    { id: '4', plot: 'Twelve cent plot off Kovalam beach road', survey: '91/2', price: '13200000', area: '12', unit: 'CENT', status: 'SOLD', locality: 'Kovalam' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
          Development only
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">Design system</h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Every primitive from WP0.5, at the states features will use. Resize to 360px to check the
          responsive behaviour, and tab through to see the focus rings.
        </p>
      </header>

      <Section title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['bg-ink', 'ink'],
            ['bg-ink-muted', 'ink-muted'],
            ['bg-parchment', 'parchment'],
            ['bg-surface', 'surface'],
            ['bg-hairline', 'hairline'],
            ['bg-moss', 'moss'],
            ['bg-moss-dark', 'moss-dark'],
            ['bg-clay', 'clay'],
          ].map(([className, name]) => (
            <div key={name} className="rounded-card border border-hairline bg-surface p-2">
              <div className={`${className} h-12 rounded-card border border-hairline`} />
              <p className="mt-1.5 font-mono text-xs text-ink-muted">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale" description="32 / 24 / 18 / 16 / 14 / 12, sentence case throughout">
        <div className="space-y-1">
          <p className="text-3xl font-semibold text-ink">Thirty-two, semibold</p>
          <p className="text-2xl text-ink">Twenty-four, regular</p>
          <p className="text-lg font-semibold text-ink">Eighteen, semibold — prices and areas</p>
          <p className="text-base text-ink">Sixteen, body copy</p>
          <p className="text-sm text-ink-muted">Fourteen, secondary</p>
          <p className="text-xs text-ink-muted">Twelve, captions and hints</p>
          <p className="font-mono text-sm text-ink">IBM Plex Mono — survey 142/3B</p>
        </div>
      </Section>

      <Section title="Plot identity strip" description="The signature element: survey number, area, locality in mono">
        <div className="space-y-3">
          <PlotIdentityStrip surveyNumber="142/3B" areaValue="10" areaUnit="CENT" locality="Kazhakkoottam" />
          <PlotIdentityStrip surveyNumber="402/1" areaValue="2" areaUnit="ACRE" locality="Vellanad" size="sm" />
          <PlotIdentityStrip surveyNumber={null} areaValue="1150" areaUnit="SQFT" locality={null} />
        </div>
      </Section>

      <Section title="Buttons" description="Labels name their outcome — never “Submit”">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Register interest</Button>
            <Button variant="secondary">Request site visit</Button>
            <Button variant="ghost">Save plot</Button>
            <Button variant="danger">Withdraw listing</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small primary</Button>
            <Button size="sm" variant="secondary" iconLeft={<Bookmark className="size-4" />}>
              With icon
            </Button>
            <Button loading>Saving</Button>
            <Button disabled>Unavailable</Button>
          </div>
          <div className="max-w-xs">
            <Button fullWidth>Full width, for narrow screens</Button>
          </div>
        </div>
      </Section>

      <Section title="Form controls" description="Every control has a real label and wires its hint and error to the input">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" placeholder="Meera Krishnan" required />
          <Input label="Email" type="email" hint="We only use this to reply to your enquiry." />
          <Input label="Indicative amount" prefix="₹" placeholder="500000" />
          <Input label="Pincode" error="Enter a 6-digit pincode" defaultValue="69" />
          <Select
            label="Plot type"
            placeholder="Any type"
            options={toSelectOptions(PROPERTY_TYPE_LABEL)}
          />
          <Select
            label="Status"
            options={toSelectOptions(PROPERTY_STATUS_LABEL)}
            defaultValue="AVAILABLE"
            hint="Agents see every status."
          />
          <Input label="Disabled" defaultValue="Not editable" disabled />
          <Textarea
            label="Message"
            placeholder="Ask about the survey sketch, boundary or access road."
            hint="At least 10 characters."
          />
          <Checkbox
            label="Only group purchase opportunities"
            description="Plots the agency is gathering interest in."
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <Checkbox label="With an error" error="You need to accept this to continue." />
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader
              title="Ownership record"
              description="Registered 4 March 2025"
              action={<Badge tone="moss">40% share</Badge>}
            />
            <CardBody>
              <PlotIdentityStrip
                surveyNumber="29/4C"
                areaValue="16"
                areaUnit="CENT"
                locality="Mararikulam"
                size="sm"
              />
              <p className="mt-3 text-sm text-ink-muted">
                Joint purchase recorded as a 40% share. Document ALP/MRK/2025/0417.
              </p>
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="secondary">
                View management log
              </Button>
            </CardFooter>
          </Card>

          <Card interactive className="p-4">
            <p className="text-lg font-semibold text-ink">₹58 lakh</p>
            <p className="text-sm text-ink-muted">Ten cent plot near Technopark</p>
            <PlotIdentityStrip
              className="mt-3"
              surveyNumber="142/3B"
              areaValue="10"
              areaUnit="CENT"
              locality="Kazhakkoottam"
              size="sm"
            />
          </Card>
        </div>
      </Section>

      <Section title="Badges" description="Tones come from lib/labels.js so a status reads the same everywhere">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="muted">Muted</Badge>
            <Badge tone="moss">Moss</Badge>
            <Badge tone="clay">Clay</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PROPERTY_STATUS_LABEL).map((status) => (
              <Badge key={status} tone={PROPERTY_STATUS_TONE[status]}>
                {PROPERTY_STATUS_LABEL[status]}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(ENQUIRY_STATUS_LABEL).map((status) => (
              <Badge key={status} tone={ENQUIRY_STATUS_TONE[status]}>
                {ENQUIRY_STATUS_LABEL[status]}
              </Badge>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Table" description="Scrolls horizontally inside its own container at 360px">
        <Table
          caption="Example listings"
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { key: 'plot', header: 'Plot' },
            {
              key: 'survey',
              header: 'Survey no.',
              render: (row) => <span className="font-mono text-xs">{row.survey}</span>,
            },
            { key: 'area', header: 'Area', numeric: true, render: (row) => formatArea(row.area, row.unit) },
            {
              key: 'price',
              header: 'Price',
              numeric: true,
              render: (row) => <span className="font-semibold">{formatInr(row.price)}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <Badge tone={PROPERTY_STATUS_TONE[row.status]}>
                  {PROPERTY_STATUS_LABEL[row.status]}
                </Badge>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Pagination">
        <Pagination
          meta={{ page, limit: 20, total: 143, totalPages: 8 }}
          onPageChange={setPage}
        />
      </Section>

      <Section title="Loading states" description="Never a bare spinner (Section 9.3)">
        <div className="space-y-4">
          <SkeletonText lines={3} className="max-w-md" />
          <div className="flex gap-2">
            <Skeleton className="size-16" />
            <Skeleton className="h-16 flex-1" />
          </div>
          <SkeletonCardGrid count={3} label="Loading plots" />
          <SkeletonTable rows={3} columns={5} label="Loading listings" />
        </div>
      </Section>

      <Section title="Empty and error states" description="Instruct, don’t apologise. Say what happened and what to do next.">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="No saved plots yet"
            instruction="Browse the catalogue and save one to compare it later."
            action={<Button size="sm" variant="secondary">Browse plots</Button>}
          />
          <ErrorState
            error={{ message: 'We could not reach the server.' }}
            onRetry={() => undefined}
          />
        </div>
      </Section>

      <Section title="Modal" description="Native <dialog>: focus trap, Escape, and focus restore come for free">
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open the dialog
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Withdraw your interest"
          description="This removes your entry from the register."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Keep it
              </Button>
              <Button variant="danger" size="sm" onClick={() => setModalOpen(false)}>
                Withdraw interest
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            The agency will stop contacting you about this plot. You can register interest again at
            any time.
          </p>
        </Modal>
      </Section>

      <Section title="Formatters" description="lib/format.js — money and area arrive as strings and stay exact">
        <div className="overflow-x-auto rounded-card border border-hairline bg-surface">
          <table className="w-full min-w-120 text-sm">
            <caption className="sr-only">Formatter output</caption>
            <thead>
              <tr className="border-b border-hairline bg-parchment">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Input</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Function</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Output</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {[
                ['"5800000"', 'formatInr', formatInr('5800000')],
                ['"13200000"', 'formatInr', formatInr('13200000')],
                ['"2300000"', 'formatInr', formatInr('2300000')],
                ['"45000"', 'formatInr', formatInr('45000')],
                ['"9500000.50"', 'formatInr', formatInr('9500000.50')],
                ['"5800000"', 'formatInrExact', formatInrExact('5800000')],
                ['"5800000.25"', 'formatInrExact', formatInrExact('5800000.25')],
                ['null', 'formatInr', formatInr(null)],
                ['"10", CENT', 'formatArea', formatArea('10', 'CENT')],
                ['"1", ACRE', 'formatArea', formatArea('1', 'ACRE')],
                ['"2", ACRE', 'formatArea', formatArea('2', 'ACRE')],
                ['"1150", SQFT', 'formatArea', formatArea('1150', 'SQFT')],
                ['"2026-08-08"', 'formatDate', formatDate('2026-08-08')],
                ['ISO timestamp', 'formatDateTime', formatDateTime('2026-07-30T09:00:00.000Z')],
                ['"2026-06-01"', 'formatTimeAgo', formatTimeAgo('2026-06-01')],
              ].map(([input, fn, output]) => (
                <tr key={`${fn}-${input}`} className="border-b border-hairline last:border-b-0">
                  <td className="px-3 py-2 text-ink-muted">{input}</td>
                  <td className="px-3 py-2 text-ink-muted">{fn}</td>
                  <td className="px-3 py-2 text-ink">{output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/**
 * Section wrapper for the gallery.
 * @param {{ title: string, description?: string, children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
function Section({ title, description, children }) {
  return (
    <section className="mb-10 border-t border-hairline pt-6">
      <h2 className="text-2xl text-ink">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-ink-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}
