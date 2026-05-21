'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createConstructionUpdate } from '@/lib/portal/actions'

const MILESTONES = [
  'Site preparation', 'Plot demarcation', 'Foundation work',
  'Boundary wall', 'Internal roads (base layer)', 'Underground utilities',
  'Road surfacing', 'Street lighting', 'Landscaping', 'Amenities',
  'Final inspection', 'Possession ready',
]

interface Props {
  projectId: string
}

export default function ConstructionUpdateForm({ projectId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('project_id', projectId)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await createConstructionUpdate(formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to post update')
      } else {
        form.reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium rounded-xl hover:border-indigo-300 hover:text-indigo-600">
        + Post New Construction Update
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">New Construction Update</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input name="title" required placeholder="e.g. Boundary wall 60% complete"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Milestone</label>
          <select name="milestone"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
            <option value="">Select milestone</option>
            {MILESTONES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">% Complete <span className="text-red-500">*</span></label>
          <input name="percentage_complete" type="number" required min="0" max="100" defaultValue="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Update Date</label>
          <input name="update_date" type="date" defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Publish immediately?</label>
          <select name="is_published"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
            <option value="false">Save as draft</option>
            <option value="true">Publish to clients</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea name="description" rows={3} placeholder="Describe the work completed and next steps..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Posting...' : 'Post Update'}
        </button>
      </div>
    </form>
  )
}
