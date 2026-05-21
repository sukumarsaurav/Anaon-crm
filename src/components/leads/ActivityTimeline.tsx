'use client'

import { useState } from 'react'
import {
  Phone, MessageSquare, Mail, FileText, ArrowRight,
  UserCheck, CalendarDays, Package, Mic, PlusCircle
} from 'lucide-react'
import type { LeadActivity } from '@/types/leads'
import { STAGE_CONFIG, FOLLOW_UP_OUTCOME_LABELS } from '@/types/leads'
import { formatDateTime, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import AddActivityModal from './AddActivityModal'
import Button from '@/components/ui/Button'

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  whatsapp: MessageSquare,
  email: Mail,
  sms: Mic,
  note: FileText,
  stage_change: ArrowRight,
  assignment: UserCheck,
  site_visit: CalendarDays,
  document_shared: Package,
  system: Mic,
}

const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-600',
  whatsapp: 'bg-green-100 text-green-600',
  email: 'bg-violet-100 text-violet-600',
  sms: 'bg-indigo-100 text-indigo-600',
  note: 'bg-yellow-100 text-yellow-600',
  stage_change: 'bg-orange-100 text-orange-600',
  assignment: 'bg-teal-100 text-teal-600',
  site_visit: 'bg-pink-100 text-pink-600',
  document_shared: 'bg-cyan-100 text-cyan-600',
  system: 'bg-slate-100 text-slate-500',
}

interface ActivityTimelineProps {
  activities: LeadActivity[]
  leadId: string
}

export default function ActivityTimeline({ activities, leadId }: ActivityTimelineProps) {
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Activity Timeline</h3>
        <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
          <PlusCircle size={14} />
          Log Activity
        </Button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-sm text-slate-500">No activities yet.</p>
          <p className="text-xs text-slate-400 mt-1">Log a call, note, or WhatsApp message above.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100" />

          <div className="space-y-1">
            {activities.map((activity, i) => {
              const Icon = ACTIVITY_ICONS[activity.type] ?? FileText
              const colorClass = ACTIVITY_COLORS[activity.type] ?? 'bg-slate-100 text-slate-500'

              return (
                <div key={activity.id} className="flex gap-4 group">
                  {/* Icon bubble */}
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white',
                      colorClass
                    )}
                  >
                    <Icon size={16} />
                  </div>

                  {/* Content */}
                  <div className={cn('flex-1 pb-6', i === activities.length - 1 && 'pb-0')}>
                    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 capitalize">
                            {activity.type.replace('_', ' ')}
                          </span>

                          {activity.outcome && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {FOLLOW_UP_OUTCOME_LABELS[activity.outcome]}
                            </span>
                          )}

                          {activity.stage_from && activity.stage_to && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full border',
                                  STAGE_CONFIG[activity.stage_from].bgColor,
                                  STAGE_CONFIG[activity.stage_from].textColor,
                                  STAGE_CONFIG[activity.stage_from].borderColor
                                )}
                              >
                                {STAGE_CONFIG[activity.stage_from].label}
                              </span>
                              <ArrowRight size={12} className="text-slate-400" />
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full border',
                                  STAGE_CONFIG[activity.stage_to].bgColor,
                                  STAGE_CONFIG[activity.stage_to].textColor,
                                  STAGE_CONFIG[activity.stage_to].borderColor
                                )}
                              >
                                {STAGE_CONFIG[activity.stage_to].label}
                              </span>
                            </div>
                          )}
                        </div>

                        <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                          {formatDateTime(activity.created_at)}
                        </span>
                      </div>

                      {/* Notes */}
                      {activity.notes && (
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{activity.notes}</p>
                      )}

                      {/* Duration */}
                      {activity.call_duration_seconds && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          Duration: {Math.floor(activity.call_duration_seconds / 60)}m{' '}
                          {activity.call_duration_seconds % 60}s
                        </p>
                      )}

                      {/* Performed by */}
                      {activity.performer && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-medium text-slate-600">
                            {getInitials(activity.performer.full_name)}
                          </div>
                          <span className="text-xs text-slate-400">{activity.performer.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AddActivityModal
        leadId={leadId}
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  )
}
