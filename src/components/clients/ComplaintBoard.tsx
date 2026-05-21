'use client'

import { useState, useTransition } from 'react'
import { createComplaint, updateComplaintStatus } from '@/lib/clients/actions'
import {
  COMPLAINT_STATUS_CONFIG, COMPLAINT_PRIORITY_CONFIG,
  COMPLAINT_CATEGORY_LABELS,
} from '@/types/clients'
import type { Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus } from '@/types/clients'
import { formatDate } from '@/lib/utils'
import { Plus, ChevronDown } from 'lucide-react'

interface Props {
  clientId:   string
  bookings:   Array<{ id: string; booking_number: string }>
  complaints: Complaint[]
  canManage:  boolean
}

export default function ComplaintBoard({ clientId, bookings, complaints, canManage }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('client_id', clientId)
    setError(null)
    startTransition(async () => {
      const result = await createComplaint(fd)
      if (result.success) {
        setShowForm(false)
        ;(e.target as HTMLFormElement).reset()
      } else setError(result.error ?? 'Failed')
    })
  }

  function handleStatusChange(complaintId: string, status: ComplaintStatus, resolution?: string) {
    startTransition(async () => {
      await updateComplaintStatus(complaintId, status, resolution)
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Complaints</h3>
          {complaints.filter((c) => c.status !== 'resolved').length > 0 && (
            <p className="text-xs text-red-600 mt-0.5">
              {complaints.filter((c) => c.status !== 'resolved').length} open
            </p>
          )}
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">
          <Plus size={12} /> Raise
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 p-4 bg-red-50 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
              <select name="category" required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select name="priority" defaultValue="normal"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {(['low', 'normal', 'high', 'urgent'] as ComplaintPriority[]).map((p) => (
                  <option key={p} value={p}>{COMPLAINT_PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            {bookings.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Booking (optional)</label>
                <select name="booking_id"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— None —</option>
                  {bookings.map((b) => <option key={b.id} value={b.id}>{b.booking_number}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
              <textarea name="description" required rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending}
              className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-40">
              {isPending ? 'Submitting...' : 'Submit Complaint'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {complaints.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No complaints raised</p>
      ) : (
        <div className="space-y-2">
          {complaints.map((c) => {
            const scfg = COMPLAINT_STATUS_CONFIG[c.status]
            const pcfg = COMPLAINT_PRIORITY_CONFIG[c.priority ?? 'normal']
            const isExpanded = expandedId === c.id

            return (
              <div key={c.id} className={`rounded-xl border ${
                c.status === 'open' || c.status === 'escalated'
                  ? 'border-red-200 bg-red-50'
                  : 'border-slate-200 bg-slate-50'
              }`}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full flex items-start justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-500">{c.ticket_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scfg.color} ${scfg.bg}`}>
                        {scfg.label}
                      </span>
                      <span className={`text-xs font-medium ${pcfg.color}`}>{pcfg.label}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-1">
                      {COMPLAINT_CATEGORY_LABELS[c.category as ComplaintCategory] ?? c.category}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(c.created_at)}</p>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 mt-1 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 pt-3 space-y-3">
                    <p className="text-sm text-slate-700">{c.description}</p>

                    {c.status === 'resolved' && c.resolution_notes && (
                      <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                        <span className="font-medium">Resolution:</span> {c.resolution_notes}
                      </div>
                    )}

                    {canManage && c.status !== 'resolved' && (
                      <div className="flex gap-2 flex-wrap">
                        {c.status === 'open' && (
                          <button
                            onClick={() => handleStatusChange(c.id, 'in_progress')}
                            disabled={isPending}
                            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40">
                            Mark In Progress
                          </button>
                        )}
                        {c.status !== 'escalated' && (
                          <button
                            onClick={() => handleStatusChange(c.id, 'escalated')}
                            disabled={isPending}
                            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40">
                            Escalate
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const note = prompt('Resolution notes:')
                            if (note !== null) handleStatusChange(c.id, 'resolved', note)
                          }}
                          disabled={isPending}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-40">
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
