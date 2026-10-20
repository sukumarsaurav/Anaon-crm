'use client'

import { useState, useTransition } from 'react'
import { applyLeave } from '@/lib/team/actions'
import { LEAVE_TYPE_LABELS } from '@/types/team'
import Modal from '@/components/ui/Modal'

interface Props {
  onClose: () => void
}

export default function LeaveApplyForm({ onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await applyLeave(formData)
      if (result.success) {
        onClose()
      } else {
        setError(result.error ?? 'Failed to submit')
      }
    })
  }

  return (
    <Modal open onClose={onClose} title="Apply for Leave" size="sm">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="leaveapplyform-leave-type" className="block text-xs font-medium text-slate-600 mb-1">Leave Type</label>
            <select id="leaveapplyform-leave-type"
              name="leave_type"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(LEAVE_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="leaveapplyform-from-date" className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
              <input id="leaveapplyform-from-date"
                name="from_date"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="leaveapplyform-to-date" className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
              <input id="leaveapplyform-to-date"
                name="to_date"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="leaveapplyform-reason" className="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
            <textarea id="leaveapplyform-reason"
              name="reason"
              rows={3}
              placeholder="Brief reason for leave..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40"
            >
              {isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </form>
    </Modal>
  )
}
