'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDeletionRequestStatus } from '@/lib/legal/actions'
import type { DeletionRequestStatus } from '@/types/legal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Props { id: string; currentStatus: DeletionRequestStatus }

export default function DeletionRequestActions({ id, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const toast = useToast()
  const askConfirm = useConfirm()

  async function handle(status: DeletionRequestStatus) {
    if (status === 'completed' && !(await askConfirm({
      title: 'Erase this person’s data?',
      message: 'Their name, contact details, KYC files, WhatsApp chats and notes are deleted or anonymised now. Bookings and payments are kept for legal retention. This cannot be undone.',
      confirmLabel: 'Erase data',
    }))) return
    if (status === 'rejected' && !notes.trim()) { setShowNotes(true); toast.error('Add a note saying why the request is rejected'); return }
    setLoading(true)
    startTransition(async () => {
      // The result used to be ignored, so a failed erasure looked like nothing happened.
      const res = await updateDeletionRequestStatus(id, status, notes || undefined)
      setLoading(false)
      if (!res.success) { toast.error(res.error ?? 'Could not update the request'); return }
      toast.success(status === 'completed' ? 'Data erased' : 'Request updated')
      setShowNotes(false)
      router.refresh()
    })
  }

  if (currentStatus === 'completed' || currentStatus === 'rejected') return null

  return (
    <div className="space-y-2">
      {showNotes && (
        <textarea aria-label="Admin notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Admin notes (optional)"
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
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
          {loading ? '...' : 'Erase & complete'}
        </button>
        <button onClick={() => handle('rejected')} disabled={loading}
          className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50">
          Reject
        </button>
      </div>
    </div>
  )
}
