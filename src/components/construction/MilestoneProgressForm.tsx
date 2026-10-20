'use client'

import FileUrlInput from '@/components/ui/FileUrlInput'

import { todayIST } from '@/lib/datetime'
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
  const [photoText, setPhotoText] = useState('')
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
          <label htmlFor="milestone-completion" className="font-medium">Completion</label>
          <span className="font-bold text-primary-600">{completion}%</span>
        </div>
        <input id="milestone-completion" type="range" min={0} max={100} step={5} value={completion}
          onChange={(e) => handleCompletionChange(parseInt(e.target.value, 10))}
          className="w-full accent-primary-600" />
      </div>

      {/* Status */}
      <div>
        <label htmlFor="milestoneprogressform-status" className="block text-xs font-medium text-slate-600 mb-1">Status</label>
        <select id="milestoneprogressform-status" value={status} onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Completion date (shown when marking complete) */}
      {status === 'completed' && (
        <div>
          <label htmlFor="milestoneprogressform-completion-date" className="block text-xs font-medium text-slate-600 mb-1">Completion Date</label>
          <input id="milestoneprogressform-completion-date" type="date" name="completion_date"
            defaultValue={milestone.actual_completion_date ?? todayIST()}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
        </div>
      )}

      {/* Photos: upload, or paste links one per line */}
      <div className="space-y-2">
        <FileUrlInput name="_photo_upload" label="Add photo" folder="construction" scopeId={projectId}
          accept="image/jpeg,image/png,image/webp,image/heic" placeholder="Upload a photo"
          onChange={(url) => { if (url.startsWith('/api/files/')) setPhotoText((t) => (t.trim() ? `${t.trim()}\n${url}` : url)) }} />
        <label htmlFor="milestoneprogressform-photo-bulk" className="block text-xs font-medium text-slate-600">
          Photo links <span className="text-slate-400">(one per line)</span>
        </label>
        <textarea id="milestoneprogressform-photo-bulk" rows={2} value={photoText}
          onChange={(e) => setPhotoText(e.target.value)}
          placeholder="https://…"
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 font-mono" />
        {photoText.split('\n').map((u) => u.trim()).filter(Boolean).map((url) => (
          <input key={url} type="hidden" name="photos" value={url} />
        ))}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="milestoneprogressform-notes" className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea id="milestoneprogressform-notes" name="notes" rows={2} defaultValue={milestone.notes ?? ''}
          placeholder="Describe work completed, next steps..."
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Progress'}
        </button>
      </div>
    </form>
  )
}
