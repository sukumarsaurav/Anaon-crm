'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { setMonthlyTarget } from '@/lib/team/actions'
import type { TeamMember, TeamTarget } from '@/types/team'

interface Props {
  member: TeamMember
  existingTarget: TeamTarget | null
  month: number
  year: number
  onClose: () => void
}

export default function SetTargetModal({ member, existingTarget, month, year, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('user_id', member.id)
    formData.set('month', String(month))
    formData.set('year', String(year))
    setError(null)
    startTransition(async () => {
      const result = await setMonthlyTarget(formData)
      if (result.success) {
        onClose()
      } else {
        setError(result.error ?? 'Failed to save target')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Set Monthly Target</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            Setting target for <strong>{member.full_name}</strong> —{' '}
            {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Revenue Target (₹)</label>
              <input
                name="target_revenue"
                type="number"
                min="0"
                defaultValue={existingTarget?.target_revenue ?? ''}
                placeholder="5000000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bookings</label>
              <input
                name="target_bookings"
                type="number"
                min="0"
                defaultValue={existingTarget?.target_bookings ?? ''}
                placeholder="5"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Site Visits</label>
              <input
                name="target_site_visits"
                type="number"
                min="0"
                defaultValue={existingTarget?.target_site_visits ?? ''}
                placeholder="20"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calls</label>
              <input
                name="target_calls"
                type="number"
                min="0"
                defaultValue={existingTarget?.target_calls ?? ''}
                placeholder="200"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              {isPending ? 'Saving...' : 'Save Target'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
