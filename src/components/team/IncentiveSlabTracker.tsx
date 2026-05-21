import { formatCurrency } from '@/lib/utils'
import { calculateCommission } from '@/lib/team/commission'
import type { IncentiveSlab, MonthlyKPI } from '@/types/team'

interface Props {
  slabs: IncentiveSlab[]
  kpi: MonthlyKPI
  totalRevenue: number
}

export default function IncentiveSlabTracker({ slabs, kpi, totalRevenue }: Props) {
  const result = calculateCommission(kpi.bookings_done, totalRevenue, slabs)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900 mb-4">Incentive Tracker</h3>

      {/* Slab ladder */}
      <div className="space-y-2 mb-5">
        {slabs.map((slab) => {
          const isCurrent = result.current_slab?.id === slab.id
          return (
            <div
              key={slab.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                isCurrent
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {isCurrent && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                <span className={`font-medium ${isCurrent ? 'text-amber-800' : 'text-slate-700'}`}>
                  {slab.label}
                </span>
                <span className="text-xs text-slate-500">
                  ({slab.from_bookings}{slab.to_bookings ? `–${slab.to_bookings}` : '+'} bookings)
                </span>
              </div>
              <div className="text-right">
                <span className={`font-semibold ${isCurrent ? 'text-amber-700' : 'text-slate-600'}`}>
                  {slab.commission_percent}%
                </span>
                {slab.bonus_amount > 0 && (
                  <span className="text-xs text-green-600 ml-1">+{formatCurrency(slab.bonus_amount)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Commission summary */}
      <div className="border-t border-slate-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Bookings this month</span>
          <span className="font-semibold">{kpi.bookings_done}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Commission earned</span>
          <span className="font-semibold text-green-600">{formatCurrency(result.commission_amount)}</span>
        </div>
        {result.bonus_amount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Tier bonus</span>
            <span className="font-semibold text-amber-600">{formatCurrency(result.bonus_amount)}</span>
          </div>
        )}
        {result.next_slab && result.bookings_to_next !== null && result.bookings_to_next > 0 && (
          <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
            {result.bookings_to_next} more booking{result.bookings_to_next > 1 ? 's' : ''} to reach{' '}
            <span className="font-semibold">{result.next_slab.label}</span> tier
          </div>
        )}
      </div>
    </div>
  )
}
