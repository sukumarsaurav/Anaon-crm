'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMilestone } from '@/lib/construction/actions'
import { formatDate } from '@/lib/utils'
import { MILESTONE_STATUS_CONFIG } from '@/types/construction'
import type { ConstructionMilestone, MilestoneStatus } from '@/types/construction'
import MilestoneProgressForm from './MilestoneProgressForm'
import MilestoneDelayForm from './MilestoneDelayForm'
import {
  CheckCircle2, Clock, AlertTriangle, Circle,
  ChevronDown, ChevronUp, Pencil, AlertCircle, Trash2, IndianRupee
} from 'lucide-react'

interface Props {
  milestones: ConstructionMilestone[]
  projectId: string
}

const STATUS_ICON: Record<MilestoneStatus, React.ReactNode> = {
  pending:     <Circle size={18} className="text-slate-300" />,
  in_progress: <Clock  size={18} className="text-blue-500" />,
  completed:   <CheckCircle2 size={18} className="text-green-500" />,
  delayed:     <AlertTriangle size={18} className="text-red-500" />,
}

export default function MilestoneTimeline({ milestones, projectId }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [progressForm, setProgressForm] = useState<string | null>(null)
  const [delayForm, setDelayForm] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id))
    setProgressForm(null)
    setDelayForm(null)
  }

  function handleDelete(m: ConstructionMilestone) {
    if (!confirm(`Delete milestone "${m.name}"?`)) return
    startTransition(async () => {
      await deleteMilestone(m.id, projectId)
      router.refresh()
    })
  }

  const totalPct   = milestones.reduce((s, m) => s + (m.payment_percentage ?? 0), 0)
  const donePct    = milestones.filter((m) => m.status === 'completed').reduce((s, m) => s + (m.payment_percentage ?? 0), 0)
  const overall    = totalPct > 0 ? Math.round((donePct / totalPct) * 100) : 0
  const delayedCnt = milestones.filter((m) => m.status === 'delayed').length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-semibold text-slate-900">Overall Progress</span>
            {delayedCnt > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                {delayedCnt} delayed
              </span>
            )}
          </div>
          <span className="text-xl font-bold text-indigo-600">{overall}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all"
            style={{ width: `${overall}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span>{milestones.filter((m) => m.status === 'completed').length}/{milestones.length} milestones done</span>
          <span>{milestones.filter((m) => m.status === 'in_progress').length} in progress</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-slate-200 z-0" />

        <div className="space-y-2">
          {milestones.map((m, idx) => {
            const cfg  = MILESTONE_STATUS_CONFIG[m.status as MilestoneStatus]
            const isOpen  = expanded === m.id
            const isOverdue = m.status !== 'completed' && m.expected_date &&
              m.expected_date < new Date().toISOString().split('T')[0]

            return (
              <div key={m.id} className="relative z-10">
                {/* Row */}
                <div className={`bg-white border rounded-xl transition-all ${isOpen ? 'border-indigo-200 shadow-sm' : 'border-slate-200'}`}>
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    {/* Status dot */}
                    <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border-2 border-slate-100 z-10">
                      {STATUS_ICON[m.status as MilestoneStatus]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {m.sequence_order}. {m.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {m.is_payment_trigger && m.payment_percentage > 0 && (
                          <span className="flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200">
                            <IndianRupee size={9} />{m.payment_percentage}%
                          </span>
                        )}
                        {isOverdue && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">
                            <AlertCircle size={10} /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {m.expected_date && `Expected: ${formatDate(m.expected_date)}`}
                        {m.actual_completion_date && ` · Completed: ${formatDate(m.actual_completion_date)}`}
                        {m.revised_expected_date && ` · Revised: ${formatDate(m.revised_expected_date)}`}
                      </p>
                    </div>

                    {/* Progress % + chevron */}
                    <div className="shrink-0 flex items-center gap-2">
                      {m.status !== 'pending' && (
                        <span className="text-base font-bold text-slate-700">{m.completion_percentage}%</span>
                      )}
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-100">
                      {/* Progress bar */}
                      <div className="mt-3 mb-3">
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${m.status === 'completed' ? 'bg-green-500' : m.status === 'delayed' ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${m.completion_percentage}%` }} />
                        </div>
                      </div>

                      {m.description && <p className="text-xs text-slate-600 mb-2">{m.description}</p>}
                      {m.notes && <p className="text-xs text-slate-500 italic mb-2">{m.notes}</p>}

                      {/* Delay info */}
                      {m.status === 'delayed' && m.delay_reason && (
                        <div className="mb-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                          <strong>Delay reason:</strong> {m.delay_reason}
                        </div>
                      )}

                      {/* Photos */}
                      {m.photos && m.photos.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto">
                          {m.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Photo ${i + 1}`}
                                className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {progressForm !== m.id && delayForm !== m.id && m.status !== 'completed' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => { setProgressForm(m.id); setDelayForm(null) }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100">
                            <Pencil size={11} /> Update Progress
                          </button>
                          {m.status !== 'delayed' && (
                            <button
                              onClick={() => { setDelayForm(m.id); setProgressForm(null) }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100">
                              <AlertTriangle size={11} /> Flag Delay
                            </button>
                          )}
                          {m.status === 'delayed' && (
                            <button
                              onClick={() => { setProgressForm(m.id); setDelayForm(null) }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100">
                              <Pencil size={11} /> Update & Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(m)}
                            className="flex items-center gap-1 px-3 py-1.5 text-slate-400 text-xs rounded-lg hover:bg-slate-100 hover:text-red-600">
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      )}

                      {m.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className="text-xs text-green-700 font-medium">
                            Completed{m.actual_completion_date ? ` on ${formatDate(m.actual_completion_date)}` : ''}
                            {m.completer ? ` by ${m.completer.full_name}` : ''}
                          </span>
                          <button
                            onClick={() => handleDelete(m)}
                            className="ml-auto flex items-center gap-1 px-3 py-1 text-slate-400 text-xs rounded-lg hover:bg-slate-100 hover:text-red-600">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}

                      {/* Progress form */}
                      {progressForm === m.id && (
                        <MilestoneProgressForm
                          milestone={m}
                          projectId={projectId}
                          onClose={() => setProgressForm(null)}
                        />
                      )}

                      {/* Delay form */}
                      {delayForm === m.id && (
                        <MilestoneDelayForm
                          milestone={m}
                          projectId={projectId}
                          onClose={() => setDelayForm(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
