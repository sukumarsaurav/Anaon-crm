'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignComplaint, updateComplaintStatus } from '@/lib/clients/actions'
import { COMPLAINT_STATUS_CONFIG } from '@/types/clients'
import type { ComplaintStatus } from '@/types/clients'
import { usePrompt } from '@/components/ui/PromptDialog'

interface Props {
  complaintId: string
  status: ComplaintStatus
  assignedTo: string | null
  staff: { id: string; full_name: string }[]
  canAssign: boolean
}

/** Assign and change status from the complaints queue. Resolving asks for the resolution note. */
export default function ComplaintQueueActions({ complaintId, status, assignedTo, staff, canAssign }: Props) {
  const router = useRouter()
  const askPrompt = usePrompt()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) setError(res.error ?? 'Could not save')
      else router.refresh()
    })
  }

  async function onStatus(next: ComplaintStatus) {
    if (next === status) return
    if (next === 'resolved') {
      const note = await askPrompt('Resolution note', { title: 'Resolve complaint', confirmLabel: 'Resolve' })
      if (note == null) return
      run(() => updateComplaintStatus(complaintId, 'resolved', note))
    } else {
      run(() => updateComplaintStatus(complaintId, next))
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {canAssign && (
          <select aria-label="Assign to" disabled={pending} value={assignedTo ?? ''}
            onChange={(e) => e.target.value && run(() => assignComplaint(complaintId, e.target.value))}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 max-w-40">
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
        <select aria-label="Status" disabled={pending} value={status}
          onChange={(e) => onStatus(e.target.value as ComplaintStatus)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700">
          {(Object.keys(COMPLAINT_STATUS_CONFIG) as ComplaintStatus[]).map((s) => (
            <option key={s} value={s}>{COMPLAINT_STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
