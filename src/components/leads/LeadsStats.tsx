import { Users, Flame, Clock, CalendarCheck } from 'lucide-react'
import { StatCard } from '@/components/ui/Card'

interface LeadsStatsProps {
  stats: {
    total: number
    hot: number
    overdue: number
    todayFollowups: number
    newToday: number
  }
}

export default function LeadsStats({ stats }: LeadsStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Leads"
        value={stats.total}
        sub={`${stats.newToday} added today`}
        icon={<Users size={20} className="text-indigo-600" />}
        iconBg="bg-indigo-50"
        accent="border-indigo-500"
      />
      <StatCard
        label="Hot Leads"
        value={stats.hot}
        sub="Score 80+"
        icon={<Flame size={20} className="text-red-600" />}
        iconBg="bg-red-50"
        accent="border-red-500"
      />
      <StatCard
        label="Overdue Follow-ups"
        value={stats.overdue}
        sub="Needs immediate action"
        icon={<Clock size={20} className="text-amber-600" />}
        iconBg="bg-amber-50"
        accent={stats.overdue > 0 ? 'border-amber-500' : 'border-slate-200'}
      />
      <StatCard
        label="Today's Follow-ups"
        value={stats.todayFollowups}
        sub="Scheduled for today"
        icon={<CalendarCheck size={20} className="text-emerald-600" />}
        iconBg="bg-emerald-50"
        accent="border-emerald-500"
      />
    </div>
  )
}
