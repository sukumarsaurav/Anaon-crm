'use client'

import { useState, useTransition } from 'react'
import { UserCheck, CalendarClock, ArrowRight, Trash2 } from 'lucide-react'
import type { Lead, LeadStage } from '@/types/leads'
import { STAGE_CONFIG, STAGE_ORDER, TERMINAL_STAGES } from '@/types/leads'
import Button from '@/components/ui/Button'
import AssignModal from './AssignModal'
import FollowUpModal from './FollowUpModal'
import AddActivityModal from './AddActivityModal'
import { changeLeadStage, deleteLead } from '@/lib/leads/actions'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface LeadDetailActionsProps {
  lead: Lead
  advisors: { id: string; full_name: string; role: string }[]
}

export default function LeadDetailActions({ lead, advisors }: LeadDetailActionsProps) {
  const [showAssign, setShowAssign] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const nextStages = STAGE_ORDER.filter(
    (s) => !TERMINAL_STAGES.includes(s) && s !== lead.stage
  ).slice(STAGE_ORDER.indexOf(lead.stage) + 1, STAGE_ORDER.indexOf(lead.stage) + 3)

  const handleAdvanceStage = (stage: LeadStage) => {
    startTransition(async () => {
      await changeLeadStage(lead.id, stage)
    })
  }

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this lead? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteLead(lead.id)
      if (result.success) router.push('/leads')
    })
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center flex-wrap gap-2">
          {/* Log activity */}
          <Button onClick={() => setShowActivity(true)} size="sm">
            Log Activity
          </Button>

          {/* Schedule follow-up */}
          <Button variant="secondary" size="sm" onClick={() => setShowFollowUp(true)}>
            <CalendarClock size={15} />
            Follow-up
          </Button>

          {/* Reassign */}
          <Button variant="secondary" size="sm" onClick={() => setShowAssign(true)}>
            <UserCheck size={15} />
            Reassign
          </Button>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Quick stage advance */}
          {nextStages.map((stage) => {
            const cfg = STAGE_CONFIG[stage]
            return (
              <button
                key={stage}
                onClick={() => handleAdvanceStage(stage)}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                  cfg.bgColor,
                  cfg.textColor,
                  cfg.borderColor,
                  'hover:opacity-80'
                )}
              >
                <ArrowRight size={12} />
                Move to {cfg.label}
              </button>
            )
          })}

          {/* Terminal stages */}
          {!TERMINAL_STAGES.includes(lead.stage) && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => handleAdvanceStage('not_interested')}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                Mark Not Interested
              </button>
              <button
                onClick={() => handleAdvanceStage('future_followup')}
                disabled={isPending}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Nurture Later
              </button>
            </div>
          )}
        </div>
      </div>

      <AssignModal
        leadId={lead.id}
        currentAdvisorId={lead.assigned_to}
        advisors={advisors}
        open={showAssign}
        onClose={() => setShowAssign(false)}
      />
      <FollowUpModal
        leadId={lead.id}
        open={showFollowUp}
        onClose={() => setShowFollowUp(false)}
      />
      <AddActivityModal
        leadId={lead.id}
        open={showActivity}
        onClose={() => setShowActivity(false)}
      />
    </>
  )
}
