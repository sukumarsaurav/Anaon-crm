'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDeletionRequestStatus } from '@/lib/legal/actions'
import type { DeletionRequestStatus } from '@/types/legal'

interface Props { id: string; currentStatus: DeletionRequestStatus }

export default function DeletionRequestActions({ id, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  function handle(status: DeletionRequestStatus) {
    setLoading(true)
    startTransition(async () => {
      await updateDeletionRequestStatus(id, status, notes || undefined)
      setLoading(false)
      setShowNotes(false)
      router.refresh()
    })
  }

  if (currentStatus === 'completed' || currentStatus === 'rejected') return null

  return (
    <div className="space-y-2">
      {showNotes && (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Admin notes (optional)"
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      )}
      <div className="flex gap-2 flex-wrap">
        {currentStatus === 'pending' && (
          <button onClick={() => handle('in_progress')} disabled={loading}
            className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">
            Mark In Progress
          </button>
        )}
        <button onClick={() => { setShowNotes(s => !s) }}
          className="px-3 py-1 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
          {showNotes ? 'Hide' : 'Add Notes'}
        </button>
        <button onClick={() => handle('completed')} disabled={loading}
          className="px-3 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50">
          {loading ? '...' : 'Mark Completed'}
        </button>
        <button onClick={() => handle('rejected')} disabled={loading}
          className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50">
          Reject
        </button>
      </div>
    </div>
  )
}
