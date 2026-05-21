'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveBooking, rejectBooking } from '@/lib/bookings/actions'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  bookingId: string
}

export default function ApprovalPanel({ bookingId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode]   = useState<'idle' | 'reject'>('idle')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveBooking(bookingId, notes || undefined)
      if (result.success) router.refresh()
      else setError(result.error ?? 'Failed')
    })
  }

  function handleReject() {
    if (!notes.trim()) { setError('Please provide a reason for rejection'); return }
    setError(null)
    startTransition(async () => {
      const result = await rejectBooking(bookingId, notes)
      if (result.success) router.refresh()
      else setError(result.error ?? 'Failed')
    })
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <h3 className="font-semibold text-amber-800">Pending Manager Approval</h3>
      </div>
      <p className="text-sm text-amber-700 mb-4">
        Review the booking details above and approve or reject below.
      </p>

      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {mode === 'reject' ? 'Rejection Reason *' : 'Approval Notes (optional)'}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={mode === 'reject' ? 'State reason for rejection...' : 'Add notes (optional)...'}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {mode === 'idle' ? (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
            {isPending ? 'Approving...' : 'Approve Booking'}
          </button>
          <button
            onClick={() => setMode('reject')}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40"
          >
            <XCircle size={15} />
            Reject
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40"
          >
            <XCircle size={15} />
            {isPending ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
          <button
            onClick={() => { setMode('idle'); setError(null) }}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}
