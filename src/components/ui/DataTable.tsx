import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  key: string
  header: React.ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  /** When omitted, the cell renders `row[key]`. */
  render?: (row: T, index: number) => React.ReactNode
  /** Hide on small screens. Useful for secondary metadata. */
  hideOn?: 'sm' | 'md' | 'lg'
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  /** Stable key per row. */
  rowKey: (row: T, index: number) => string
  empty?: React.ReactNode
  /** Wrap the table in a Card-style border. Defaults to true. */
  bordered?: boolean
  /** Compact row padding (`py-2`) for dense tables. Default false (`py-3`). */
  dense?: boolean
  className?: string
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

const hideOnClass: Record<NonNullable<DataTableColumn<unknown>['hideOn']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  bordered = true,
  dense = false,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return (
      <div
        className={cn(
          bordered && 'bg-white rounded-xl border border-slate-200',
          className,
        )}
      >
        {empty}
      </div>
    )
  }

  const cellPad = dense ? 'px-4 py-2' : 'px-4 py-3'

  return (
    <div
      className={cn(
        'overflow-x-auto',
        bordered && 'bg-white rounded-xl border border-slate-200',
        className,
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide',
                  alignClass[col.align ?? 'left'],
                  col.hideOn && hideOnClass[col.hideOn],
                  col.className,
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    cellPad,
                    'text-sm text-slate-700',
                    alignClass[col.align ?? 'left'],
                    col.hideOn && hideOnClass[col.hideOn],
                    col.className,
                  )}
                >
                  {col.render
                    ? col.render(row, i)
                    : ((row as Record<string, React.ReactNode>)[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
