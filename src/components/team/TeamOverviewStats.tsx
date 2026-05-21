import { formatCurrency } from '@/lib/utils'
import type { MemberPerformanceSummary } from '@/types/team'
import {
  Users, Phone, RotateCcw, MapPin, Award, IndianRupee, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

interface Props {
  summaries: MemberPerformanceSummary[]
}

export default function TeamOverviewStats({ summaries }: Props) {
  const totals = summaries.reduce(
    (acc, s) => ({
      calls:     acc.calls     + s.today_kpi.calls_made,
      followups: acc.followups + s.today_kpi.followups_completed,
      visits:    acc.visits    + s.monthly_kpi.site_visits_completed,
      bookings:  acc.bookings  + s.monthly_kpi.bookings_done,
      revenue:   acc.revenue   + s.monthly_kpi.revenue_generated,
      active:    acc.active    + (s.today_attendance?.status === 'present' ? 1 : 0),
    }),
    { calls: 0, followups: 0, visits: 0, bookings: 0, revenue: 0, active: 0 }
  )

  const atRisk = summaries.filter((s) => s.is_at_risk).length

  const stats: { label: string; value: string | number; Icon: LucideIcon; color: string }[] = [
    { label: 'Active Today',     value: `${totals.active}/${summaries.length}`, Icon: Users,         color: 'text-green-600' },
    { label: 'Calls Today',      value: totals.calls,                           Icon: Phone,         color: 'text-blue-600' },
    { label: 'Follow-ups Done',  value: totals.followups,                       Icon: RotateCcw,     color: 'text-purple-600' },
    { label: 'Visits (Month)',   value: totals.visits,                          Icon: MapPin,        color: 'text-amber-600' },
    { label: 'Bookings (Month)', value: totals.bookings,                        Icon: Award,         color: 'text-green-600' },
    { label: 'Revenue (Month)',  value: formatCurrency(totals.revenue),         Icon: IndianRupee,   color: 'text-indigo-600' },
    { label: 'At Risk',          value: atRisk,                                 Icon: AlertTriangle, color: atRisk > 0 ? 'text-red-600' : 'text-slate-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <s.Icon size={16} className={`mx-auto mb-1 ${s.color}`} />
          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
