'use client'

import { useState, useTransition } from 'react'
import { formatDate } from '@/lib/utils'
import { schedulePriceEscalation } from '@/lib/inventory/actions'
import type { PriceEscalation } from '@/types/inventory'

interface Props {
  projectId: string
  escalations: PriceEscalation[]
  canManage: boolean
}

export default function PriceEscalationPanel({ projectId, escalations, canManage }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('project_id', projectId)
    setError(null)
    startTransition(async () => {
      const result = await schedulePriceEscalation(formData)
      if (result.success) {
        setShowForm(false)
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Price Escalations</h3>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)}
            className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium">
            + Schedule
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-indigo-50 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Escalation Date *</label>
              <input name="escalation_date" type="date" required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">% Increase *</label>
              <input name="percentage_increase" type="number" step="0.1" min="0.1" required
                placeholder="5"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input name="notes" placeholder="Q2 2025 price revision"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
              {isPending ? 'Saving...' : 'Schedule'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {escalations.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No escalations scheduled</p>
      ) : (
        <div className="space-y-2">
          {escalations.map((e) => (
            <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
              e.applied ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
            }`}>
              <div>
                <span className="text-sm font-medium text-slate-800">+{e.percentage_increase}%</span>
                {e.notes && <span className="text-xs text-slate-500 ml-2">{e.notes}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{formatDate(e.escalation_date)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  e.applied ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {e.applied ? 'Applied' : 'Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
