export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getConstructionDashboard } from '@/lib/construction/queries'
import { formatDate } from '@/lib/utils'
import { MILESTONE_STATUS_CONFIG } from '@/types/construction'
import type { MilestoneStatus } from '@/types/construction'
import {
  AlertTriangle, CheckCircle2, Clock, Building2,
  ChevronRight, IndianRupee, TrendingUp
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'

export default async function ConstructionDashboardPage() {
  const data = await getConstructionDashboard()

  const statsCards = [
    {
      label:  'Active Projects',
      value:  data.projects.length,
      icon:   Building2,
      color:  'text-indigo-600',
      bg:     'bg-indigo-50',
    },
    {
      label:  'In Progress',
      value:  data.total_in_progress,
      icon:   Clock,
      color:  'text-blue-600',
      bg:     'bg-blue-50',
    },
    {
      label:  'Delayed Milestones',
      value:  data.total_delayed,
      icon:   AlertTriangle,
      color:  data.total_delayed > 0 ? 'text-red-600' : 'text-slate-400',
      bg:     data.total_delayed > 0 ? 'bg-red-50' : 'bg-slate-50',
    },
    {
      label:  'Completed (recent)',
      value:  data.recent_completions.length,
      icon:   CheckCircle2,
      color:  'text-green-600',
      bg:     'bg-green-50',
    },
  ]

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Construction Dashboard"
        subtitle="Phase-by-phase progress across all active projects"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} padding="sm">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Active projects grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Projects Overview</h2>
        {data.projects.length === 0 ? (
          <EmptyState
            bordered
            icon={<Building2 size={40} />}
            title="No active projects with milestone tracking"
            description="Go to a project's Construction tab to set up milestones."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.projects.map((p) => (
              <Card
                key={p.id}
                href={`/inventory/${p.id}/construction`}
                padding="md"
                className="group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-700">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.city} · {p.type}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 mt-0.5" />
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span className="font-semibold text-indigo-600">{p.overall_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${p.overall_percentage}%` }} />
                  </div>
                </div>

                {/* Milestone counts */}
                <div className="flex gap-3 text-xs mb-3">
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={14} /> {p.completed_count} done
                  </span>
                  {p.in_progress_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <Clock size={14} /> {p.in_progress_count} active
                    </span>
                  )}
                  {p.delayed_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={14} /> {p.delayed_count} delayed
                    </span>
                  )}
                </div>

                {/* Current milestone */}
                {p.current_milestone && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-400 mb-0.5">Current milestone</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${MILESTONE_STATUS_CONFIG[p.current_milestone.status as MilestoneStatus]?.dot}`} />
                      <p className="text-xs font-medium text-slate-700">{p.current_milestone.name}</p>
                      <span className="text-xs text-slate-400">{p.current_milestone.completion_percentage}%</span>
                    </div>
                  </div>
                )}

                {p.milestone_count === 0 && (
                  <p className="text-xs text-amber-600 italic">No milestones set up yet</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Delayed milestones */}
      {data.delayed_milestones.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-900">Delayed Milestones</h2>
            <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full font-medium">
              {data.delayed_milestones.length}
            </span>
          </div>
          <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {data.delayed_milestones.map((m) => (
                <div key={m.id} className="flex items-start justify-between p-4 hover:bg-red-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                      {m.is_payment_trigger && m.payment_percentage > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <IndianRupee size={14} />{m.payment_percentage}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {m.project_name} · {m.project_city}
                    </p>
                    {m.expected_date && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Expected: {formatDate(m.expected_date)}
                        {m.revised_expected_date && ` → Revised: ${formatDate(m.revised_expected_date)}`}
                      </p>
                    )}
                    {m.delay_reason && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">{m.delay_reason}</p>
                    )}
                  </div>
                  <Link href={`/inventory/${m.project_id}/construction`}
                    className="shrink-0 px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg">
                    View →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent completions */}
      {data.recent_completions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" />
            <h2 className="text-sm font-semibold text-slate-900">Recent Completions</h2>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {data.recent_completions.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-500" />
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                      {m.payment_percentage > 0 && (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {m.payment_percentage}% demand
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 ml-5">
                      {m.project_name} · Completed {m.actual_completion_date ? formatDate(m.actual_completion_date) : '—'}
                    </p>
                  </div>
                  <Link href={`/inventory/${m.project_id}/construction`}
                    className="text-xs text-slate-400 hover:text-indigo-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg">
                    View →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
