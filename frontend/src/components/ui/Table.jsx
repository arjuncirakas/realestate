import { cn } from '@/lib/cn.js';

const ALIGN = Object.freeze({
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
});

/**
 * A data table.
 *
 * Column-driven rather than composed from `<tr>`/`<td>` so that alignment,
 * header casing and the numeric treatment cannot drift between the four agent
 * queues that all render one of these.
 *
 * At 360px the table scrolls horizontally inside its own container — the page
 * body never scrolls sideways. Land records are genuinely tabular; collapsing
 * them into stacked cards loses the column-to-column comparison that makes a
 * queue readable.
 *
 * Loading, empty and error states are the caller's job (Section 9.3) — render
 * `Skeleton`, `EmptyState` or `ErrorState` instead of this component.
 *
 * @param {object} props
 * @param {Array<{
 *   key: string,
 *   header: string,
 *   render?: (row: object) => import('react').ReactNode,
 *   align?: 'left'|'right'|'center',
 *   numeric?: boolean,
 *   className?: string,
 *   srOnlyHeader?: boolean,
 * }>} props.columns `render` defaults to `row[key]`; `numeric` right-aligns and applies tabular figures
 * @param {Array<object>} props.rows
 * @param {(row: object, index: number) => string} props.rowKey stable React key per row
 * @param {string} props.caption describes the table for assistive technology
 * @param {(row: object) => void} [props.onRowClick]
 * @param {string} [props.className] layout classes for the scroll container
 * @returns {import('react').ReactElement}
 */
export const Table = ({ columns, rows, rowKey, caption, onRowClick, className }) => (
  <div
    className={cn('overflow-x-auto rounded-card border border-hairline bg-surface', className)}
  >
    <table className="w-full min-w-140 border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-hairline bg-parchment">
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={cn(
                // Sentence case, not uppercase (Section 7.2).
                'px-3 py-2.5 font-semibold text-ink whitespace-nowrap',
                ALIGN[column.numeric ? 'right' : (column.align ?? 'left')],
                column.className,
              )}
            >
              {column.srOnlyHeader ? <span className="sr-only">{column.header}</span> : column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={rowKey(row, index)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'border-b border-hairline last:border-b-0',
              onRowClick ? 'cursor-pointer hover:bg-parchment' : '',
            )}
          >
            {columns.map((column) => (
              <td
                key={column.key}
                className={cn(
                  'px-3 py-2.5 align-top text-ink',
                  ALIGN[column.numeric ? 'right' : (column.align ?? 'left')],
                  column.numeric ? 'tabular-nums' : '',
                  column.className,
                )}
              >
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
