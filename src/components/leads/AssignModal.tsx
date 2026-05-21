'use client'

import { useState, useTransition } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { assignLead } from '@/lib/leads/actions'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AssignModalProps {
  leadId: string
  currentAdvisorId?: string | null
  advisors: { id: string; full_name: string; role: string }[]
  open: boolean
  onClose: () => void
}

export default function AssignModal({ leadId, currentAdvisorId, advisors, open, onClose }: AssignModalProps) {
  const [selected, setSelected] = useState(currentAdvisorId ?? '')
  const [isPending, startTransition] = useTransition()

  const handleAssign = () => {
    if (!selected) return
    startTransition(async () => {
      await assignLead(leadId, selected)
      onClose()
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Lead"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleAssign} loading={isPending} disabled={!selected}>
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-sm text-slate-500 mb-3">Select a team member to assign this lead to:</p>
        {advisors.map((advisor) => (
          <button
            key={advisor.id}
            onClick={() => setSelected(advisor.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
              selected === advisor.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-semibold text-indigo-700 shrink-0">
              {getInitials(advisor.full_name)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{advisor.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{advisor.role.replace('_', ' ')}</p>
            </div>
            {selected === advisor.id && (
              <div className="ml-auto w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </Modal>
  )
}
