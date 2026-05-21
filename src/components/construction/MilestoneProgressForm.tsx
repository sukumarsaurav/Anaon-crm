'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMilestoneProgress } from '@/lib/construction/actions'
import type { ConstructionMilestone, MilestoneStatus } from '@/types/construction'

interface Props {
  milestone: ConstructionMilestone
  projectId: string
  onClose: () => void
}

export default function MilestoneProgressForm({ milestone, projectId, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completion, setCompletion] = useState(milestone.completion_percentage)
  const [status, setStatus] = useState<MilestoneStatus>(milestone.status)

  function handleCompletionChange(val: number) {
    setCompletion(val)
    if (val === 100) setStatus('completed')
    else if (val > 0 && status !== 'delayed') setStatus('in_progress')
    else if (val === 0 && status !== 'delayed') setStatus('pending')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('completion_percentage', String(completion))
    formData.set('status', status)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await updateMilestoneProgress(milestone.id, projectId, formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to update')
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
      <h4 className="text-sm font-semibold text-slate-800">Update Progress</h4>

      {/* Completion slider */}
      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <label className="font-medium">Completion</label>
          <span className="font-bold text-indigo-600">{completion}%</span>
        </div>
        <input type="range" min={0} max={100} step={5} value={completion}
          onChange={(e) => handleCompletionChange(parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600" />
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Completion date (shown when marking complete) */}
      {status === 'completed' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Completion Date</label>
          <input type="date" name="completion_date"
            defaultValue={milestone.actual_completion_date ?? new Date().toISOString().split('T')[0]}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
      )}

      {/* Photo URLs */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Photo URLs <span className="text-slate-400">(one per line)</span>
        </label>
        <textarea name="photo_bulk" rows={2}
          placeholder="https://storage.example.com/photo1.jpg&#10;https://storage.example.com/photo2.jpg"
          onChange={(e) => {
            const urls = e.target.value.split('\n').map((u) => u.trim()).filter(Boolean)
            e.target.form?.querySelectorAll('input[name="photos"]').forEach((el) => el.remove())
            urls.forEach((url) => {
              const input = document.createElement('input')
              input.type  = 'hidden'
              input.name  = 'photos'
              input.value = url
              e.target.form?.appendChild(input)
            })
          }}
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400 font-mono" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea name="notes" rows={2} defaultValue={milestone.notes ?? ''}
          placeholder="Describe work completed, next steps..."
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Progress'}
        </button>
      </div>
    </form>
  )
}
