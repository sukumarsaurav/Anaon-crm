'use client'

import { useState, startTransition } from 'react'
import { raisePortalComplaint } from '@/lib/portal/actions'
import { COMPLAINT_CATEGORY_LABELS } from '@/types/clients'

interface Props {
  clientId: string
  bookingId?: string | null
  onDone?: () => void
}

export default function ComplaintForm({ clientId, bookingId, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await raisePortalComplaint(clientId, formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
      } else {
        setDone(true)
        form.reset()
        onDone?.()
      }
    })
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p className="font-semibold text-green-800">Complaint Submitted</p>
        <p className="text-sm text-green-700 mt-1">Our team will review and respond within 24–48 hours.</p>
        <button onClick={() => setDone(false)}
          className="mt-3 px-4 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100">
          Raise Another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      {bookingId && <input type="hidden" name="booking_id" value={bookingId} />}
      <h3 className="font-semibold text-slate-900">Raise a Complaint or Request</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
        <select name="category" required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
          <option value="">Select category</option>
          {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Subject <span className="text-red-500">*</span></label>
        <input name="title" required placeholder="Brief summary of the issue"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
        <textarea name="description" required rows={4} placeholder="Describe the issue in detail..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {loading ? 'Submitting...' : 'Submit Complaint'}
      </button>
    </form>
  )
}
