'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createMilestone } from '@/lib/construction/actions'
import { Plus } from 'lucide-react'

interface Props {
  projectId: string
}

export default function AddMilestoneForm({ projectId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await createMilestone(projectId, formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to add milestone')
      } else {
        ;(e.target as HTMLFormElement).reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 text-slate-500 text-sm rounded-xl hover:border-indigo-300 hover:text-indigo-600">
        <Plus size={16} /> Add Milestone
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">New Milestone</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-500">*</span></label>
          <input name="name" required placeholder="e.g. Boundary wall completion"
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment % of Total Value</label>
          <input name="payment_percentage" type="number" min={0} max={100} step={0.5} defaultValue={0}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Expected Date</label>
          <input name="expected_date" type="date"
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <input name="description" placeholder="Brief description of the milestone"
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Trigger</label>
          <select name="is_payment_trigger"
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
            <option value="true">Yes — triggers demand letter on completion</option>
            <option value="false">No — informational only</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Adding...' : 'Add Milestone'}
        </button>
      </div>
    </form>
  )
}
