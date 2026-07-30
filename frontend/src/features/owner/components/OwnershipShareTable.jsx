import { Badge, Table } from '@/components/ui/index.js';
import { EMPTY_VALUE, formatDate } from '@/lib/format.js';
import { formatSharePercentage, sumSharePercentages } from '../format-share.js';

/**
 * Every registered share on a plot, not just the caller's own row.
 *
 * This is the single most useful thing on the record page for a joint
 * purchase — a co-owner can see exactly how the 100% is split, against whom,
 * and since when. For a sole holding it still renders, as a table of one row,
 * so the page reads the same shape either way.
 *
 * @param {object} props
 * @param {Array<object>} props.ownerships every `OwnershipResponseSchema` row on the plot
 * @param {string} props.currentUserId marks the caller's own row as "You"
 * @returns {import('react').ReactElement}
 */
export const OwnershipShareTable = ({ ownerships, currentUserId }) => (
  <div>
    <Table
      caption="Registered ownership shares on this plot"
      rowKey={(row) => row.id}
      rows={ownerships}
      columns={[
        {
          key: 'owner',
          header: 'Owner',
          render: (row) => (
            <span className="text-ink">
              {row.ownerUser?.fullName ?? EMPTY_VALUE}
              {row.ownerUserId === currentUserId && (
                <Badge tone="moss" className="ml-2">
                  You
                </Badge>
              )}
            </span>
          ),
        },
        {
          key: 'sharePercentage',
          header: 'Share',
          numeric: true,
          render: (row) => formatSharePercentage(row.sharePercentage),
        },
        {
          key: 'registeredOn',
          header: 'Registered on',
          render: (row) => formatDate(row.registeredOn),
        },
        {
          key: 'documentRef',
          header: 'Document ref.',
          render: (row) => row.documentRef || EMPTY_VALUE,
        },
      ]}
    />
    <p className="mt-2 text-xs text-ink-muted">
      Allocated so far: <span className="font-mono">{sumSharePercentages(ownerships)}</span>
    </p>
  </div>
);
