interface BarData { label: string; value: number; secondary?: string }

interface Props {
  data: BarData[]
  colorClass?: string
  formatValue?: (v: number) => string
  showValues?: boolean
  maxBars?: number
}

export default function MiniBarChart({
  data,
  colorClass = 'bg-indigo-500',
  formatValue = (v) => String(v),
  showValues = true,
  maxBars = 10,
}: Props) {
  const rows = data.slice(0, maxBars)
  const max = Math.max(...rows.map(r => r.value), 1)

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-28 shrink-0 truncate" title={row.label}>{row.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${colorClass} transition-all`}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          {showValues && (
            <span className="text-xs font-medium text-slate-700 w-16 text-right shrink-0">{formatValue(row.value)}</span>
          )}
        </div>
      ))}
    </div>
  )
}
