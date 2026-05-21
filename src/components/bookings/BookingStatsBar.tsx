import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import type { BookingStats } from '@/types/bookings'

interface Props {
  stats: BookingStats
}

export default function BookingStatsBar({ stats }: Props) {
  const tiles = [
    { label: 'Total Bookings',    value: stats.total,            color: 'text-slate-800'  },
    { label: 'Pending Approval',  value: stats.pending_approval, color: 'text-amber-600'  },
    { label: 'Confirmed',         value: stats.confirmed,        color: 'text-emerald-700' },
    { label: 'Cancelled',         value: stats.cancelled,        color: 'text-red-600'    },
    { label: 'Confirmed Value',   value: formatCurrency(stats.total_value), color: 'text-indigo-700' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {tiles.map((s) => (
        <Card key={s.label} padding="sm" className="text-center">
          <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
        </Card>
      ))}
    </div>
  )
}
