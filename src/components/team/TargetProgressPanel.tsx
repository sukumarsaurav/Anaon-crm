import { formatCurrency } from '@/lib/utils'
import type { TeamTarget, MonthlyKPI } from '@/types/team'

interface Props {
  target: TeamTarget | null
  kpi: MonthlyKPI
}

function ProgressBar({
  label,
  actual,
  target,
  formatValue,
  isAtRisk,
}: {
  label: string
  actual: number
  target: number
  formatValue: (v: number) => string
  isAtRisk?: boolean
}) {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0
  const barColor = pct >= 100 ? 'bg-green-500' : isAtRisk ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-sm font-bold ${pct >= 100 ? 'text-green-600' : isAtRisk ? 'text-red-600' : 'text-slate-900'}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
        <div className={`${barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{formatValue(actual)}</span>
        <span>Target: {formatValue(target)}</span>
      </div>
    </div>
  )
}

export default function TargetProgressPanel({ target, kpi }: Props) {
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100)

  const revenueAtRisk =
    monthPct >= 50 &&
    target &&
    target.target_revenue > 0 &&
    kpi.revenue_generated / target.target_revenue < 0.5

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Monthly Targets</h3>
        <span className="text-xs text-slate-400">Month {monthPct}% elapsed</span>
      </div>

      {!target ? (
        <p className="text-sm text-slate-400 text-center py-4">No target set for this month</p>
      ) : (
        <>
          <ProgressBar
            label="Revenue"
            actual={kpi.revenue_generated}
            target={target.target_revenue}
            formatValue={formatCurrency}
            isAtRisk={!!revenueAtRisk}
          />
          <ProgressBar
            label="Bookings"
            actual={kpi.bookings_done}
            target={target.target_bookings}
            formatValue={(v) => v.toString()}
          />
          <ProgressBar
            label="Site Visits"
            actual={kpi.site_visits_completed}
            target={target.target_site_visits}
            formatValue={(v) => v.toString()}
          />
          <ProgressBar
            label="Calls"
            actual={kpi.calls_made}
            target={target.target_calls}
            formatValue={(v) => v.toString()}
          />
        </>
      )}
    </div>
  )
}
