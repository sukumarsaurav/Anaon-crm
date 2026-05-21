import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { formatCurrency, getInitials } from '@/lib/utils'
import { ATTENDANCE_STATUS_CONFIG } from '@/types/team'
import type { MemberPerformanceSummary } from '@/types/team'

interface Props {
  summary: MemberPerformanceSummary
  rank?: number
}

function MiniBar({ pct, isAtRisk }: { pct: number; isAtRisk?: boolean }) {
  const color = pct >= 100 ? 'bg-green-500' : isAtRisk ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

export default function MemberCard({ summary, rank }: Props) {
  const { member, target, monthly_kpi, today_kpi, achievement_revenue_pct, today_attendance, is_at_risk } = summary
  const initials = getInitials(member.full_name)
  const attendanceCfg = today_attendance ? ATTENDANCE_STATUS_CONFIG[today_attendance.status] : null

  return (
    <Link href={`/team/${member.id}`} className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {rank && (
          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            rank === 1 ? 'bg-amber-100 text-amber-700' : rank === 2 ? 'bg-slate-200 text-slate-600' : rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {rank}
          </div>
        )}
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.full_name} className="w-10 h-10 rounded-full object-cover" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 text-sm truncate">{member.full_name}</div>
          <div className="text-xs text-slate-500">{member.designation ?? member.role}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {attendanceCfg && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${attendanceCfg.color} ${attendanceCfg.bg}`}>
              {attendanceCfg.label}
            </span>
          )}
          {is_at_risk && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-red-700 bg-red-50">
              <AlertTriangle size={10} /> At Risk
            </span>
          )}
        </div>
      </div>

      {/* Revenue target progress */}
      <div className="mb-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Revenue</span>
          <span className={`font-semibold ${is_at_risk ? 'text-red-600' : 'text-slate-700'}`}>
            {achievement_revenue_pct}%
          </span>
        </div>
        <MiniBar pct={achievement_revenue_pct} isAtRisk={is_at_risk} />
        <div className="flex justify-between text-xs mt-0.5 text-slate-400">
          <span>{formatCurrency(monthly_kpi.revenue_generated)}</span>
          {target && <span>/ {formatCurrency(target.target_revenue)}</span>}
        </div>
      </div>

      {/* Today's quick stats */}
      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
        <div className="text-center">
          <div className="text-sm font-bold text-slate-800">{today_kpi.calls_made}</div>
          <div className="text-xs text-slate-400">Calls</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-800">{today_kpi.followups_completed}</div>
          <div className="text-xs text-slate-400">F/ups</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-800">{monthly_kpi.bookings_done}</div>
          <div className="text-xs text-slate-400">Bookings</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-800">{today_kpi.wa_messages_sent}</div>
          <div className="text-xs text-slate-400">WA</div>
        </div>
      </div>
    </Link>
  )
}
