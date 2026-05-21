'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveLeave, rejectLeave } from '@/lib/hr/actions'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  leaveId: string
}

export default function LeaveReviewActions({ leaveId }: Props) {
  const router = useRouter()
  const [panel, setPanel] = useState<'reject' | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  function handleApprove() {
    setLoading(true)
    startTransition(async () => {
      await approveLeave(leaveId)
      setLoading(false)
      router.refresh()
    })
  }

  function handleReject(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    startTransition(async () => {
      await rejectLeave(leaveId, note)
      setLoading(false)
      setPanel(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={handleApprove} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          <CheckCircle2 size={13} /> Approve
        </button>
        <button onClick={() => setPanel('reject')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
          <XCircle size={13} /> Reject
        </button>
      </div>
      {panel === 'reject' && (
        <form onSubmit={handleReject} className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)}
              className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-1.5 text-xs bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
