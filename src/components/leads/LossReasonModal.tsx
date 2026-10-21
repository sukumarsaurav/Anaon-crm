'use client'

import { useState, useTransition } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { changeLeadStage } from '@/lib/leads/actions'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

export const LOSS_REASONS = [
  'Budget mismatch',
  'Bought elsewhere',
  'Location not suitable',
  'Not responding',
  'Plan postponed',
  'Just browsing',
  'Duplicate / invalid',
  'Other',
] as const

interface LossReasonModalProps {
  leadId: string
  open: boolean
  onClose: () => void
  /** Called after the stage is saved (the Kanban board uses it to move the card). */
  onSaved?: () => void
}

export default function LossReasonModal({ leadId, open, onClose, onSaved }: LossReasonModalProps) {
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const submit = () => {
    if (!reason) return
    const finalReason = reason === 'Other' && note.trim() ? note.trim() : reason
    startTransition(async () => {
      const result = await changeLeadStage(leadId, 'not_interested', undefined, finalReason)
      if (!result.success) {
        toast.error(result.error ?? 'Could not mark the lead Not Interested')
        return
      }
      onSaved?.()
      onClose()
      setReason('')
      setNote('')
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark Not Interested"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isPending} disabled={!reason}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Why is this lead being lost? This feeds win/loss reporting.</p>
        <div className="flex flex-wrap gap-1.5">
          {LOSS_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
                reason === r
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-red-300',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        {reason === 'Other' && (
          <textarea aria-label="Describe the reason…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the reason…"
            rows={2}
            className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
        )}
      </div>
    </Modal>
  )
}
