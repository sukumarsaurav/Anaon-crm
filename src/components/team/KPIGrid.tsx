import { formatCurrency } from '@/lib/utils'
import type { DailyKPI, MonthlyKPI } from '@/types/team'
import {
  Phone, CheckCircle2, RotateCcw, Home, MapPin,
  FileText, Award, IndianRupee, MessageSquare,
  type LucideIcon,
} from 'lucide-react'

interface Props {
  kpi: DailyKPI | MonthlyKPI
  label?: string
}

function Metric({ Icon, label, value, sub }: { Icon: LucideIcon; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-slate-400 shrink-0" />
        <span className="text-xs text-slate-500 font-medium truncate">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function KPIGrid({ kpi, label }: Props) {
  const isDaily = 'connection_rate' in kpi

  return (
    <div>
      {label && <h3 className="text-sm font-semibold text-slate-700 mb-3">{label}</h3>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Metric Icon={Phone} label="Calls Made" value={kpi.calls_made} />
        <Metric
          Icon={CheckCircle2}
          label="Connected"
          value={kpi.connected_calls}
          sub={isDaily ? `${(kpi as DailyKPI).connection_rate}% rate` : undefined}
        />
        <Metric Icon={RotateCcw} label="Follow-ups Done" value={kpi.followups_completed} />
        <Metric Icon={Home} label="Visits Scheduled" value={kpi.site_visits_scheduled} />
        <Metric Icon={MapPin} label="Visits Completed" value={kpi.site_visits_completed} />
        {isDaily && (
          <Metric Icon={FileText} label="Proposals Sent" value={(kpi as DailyKPI).proposals_sent} />
        )}
        <Metric Icon={Award} label="Bookings" value={kpi.bookings_done} />
        <Metric Icon={IndianRupee} label="Revenue" value={formatCurrency(kpi.revenue_generated)} />
        <Metric Icon={MessageSquare} label="WA Messages" value={kpi.wa_messages_sent} />
      </div>
    </div>
  )
}
