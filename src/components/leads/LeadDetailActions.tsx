'use client'

import { useState, useTransition } from 'react'
import { UserCheck, CalendarClock, ArrowRight, Trash2 } from 'lucide-react'
import type { Lead, LeadStage } from '@/types/leads'
import { STAGE_CONFIG, STAGE_ORDER, TERMINAL_STAGES } from '@/types/leads'
import Button from '@/components/ui/Button'
import AssignModal from './AssignModal'
import FollowUpModal from './FollowUpModal'
import AddActivityModal from './AddActivityModal'
import LossReasonModal from './LossReasonModal'
import { changeLeadStage, deleteLead } from '@/lib/leads/actions'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useProfile } from '@/components/layout/ProfileProvider'

interface LeadDetailActionsProps {
  lead: Lead
  advisors: { id: string; full_name: string; role: string }[]
}

export default function LeadDetailActions({ lead, advisors }: LeadDetailActionsProps) {
  const [showAssign, setShowAssign] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [showLossReason, setShowLossReason] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { role } = useProfile()
  // Matches the server rule in deleteLead(); the action re-checks it.
  const canDelete = role === 'admin'

  // The next two forward stages. This used to drop the current stage from the list and then slice
  // it with indexes from the full list, so it skipped one: Contacted never offered Interested and
  // Negotiation never offered Token Paid. Closed Won comes from an approved booking, not a button.
  const isParked = lead.stage === 'not_interested' || lead.stage === 'future_followup'
  const nextStages: LeadStage[] = isParked
    ? ['contacted', 'interested']
    : STAGE_ORDER.slice(STAGE_ORDER.indexOf(lead.stage) + 1)
        .filter((s) => !TERMINAL_STAGES.includes(s) && s !== 'future_followup')
        .slice(0, 2)

  const askConfirm = useConfirm()
  const toast = useToast()

  const handleAdvanceStage = (stage: LeadStage) => {
    startTransition(async () => {
      const result = await changeLeadStage(lead.id, stage)
      if (!result.success) toast.error(result.error ?? 'Could not change the stage')
    })
  }
  const handleDelete = async () => {
    if (!(await askConfirm({ title: 'Delete lead', message: `Delete ${lead.full_name}? The lead is removed from lists, the pipeline and reports. It is archived rather than erased, and the deletion is recorded in the audit log.`, confirmLabel: 'Delete lead' }))) return
    startTransition(async () => {
      const result = await deleteLead(lead.id)
      if (result.success) {
        toast.success('Lead deleted')
        router.push('/leads')
      } else toast.error(result.error ?? 'Could not delete the lead')
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
                {isParked ? 'Reopen as' : 'Move to'} {cfg.label}
              </button>
            )
          })}

          {/* Terminal stages */}
          {!TERMINAL_STAGES.includes(lead.stage) && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowLossReason(true)}
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

        {/* Kept apart from the everyday buttons: it sat between "Move to …" and "Mark Not
            Interested", one slip away from the most-clicked actions on the page. */}
        {canDelete && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending} className="text-red-600 hover:bg-red-50 hover:text-red-700">
              <Trash2 size={14} />
              Delete lead
            </Button>
          </div>
        )}
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
      <LossReasonModal
        leadId={lead.id}
        open={showLossReason}
        onClose={() => setShowLossReason(false)}
      />
    </>
  )
}
