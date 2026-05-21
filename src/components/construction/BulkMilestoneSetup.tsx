'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkCreateMilestones } from '@/lib/construction/actions'
import { DEFAULT_PLOTTED_MILESTONES } from '@/types/construction'
import { Layers } from 'lucide-react'

interface Props {
  projectId: string
}

export default function BulkMilestoneSetup({ projectId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  function handleSetup() {
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await bulkCreateMilestones(projectId)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to setup milestones')
      } else {
        router.refresh()
      }
    })
  }

  if (!confirm) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Layers size={20} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-900">No milestones set up yet</p>
            <p className="text-xs text-indigo-700 mt-0.5 mb-3">
              Use the standard plotted development template (9 milestones, 100% total) or add milestones manually.
            </p>
            <div className="text-xs text-indigo-800 space-y-1 mb-4">
              {DEFAULT_PLOTTED_MILESTONES.map((m) => (
                <div key={m.sequence_order} className="flex justify-between">
                  <span>{m.sequence_order}. {m.name}</span>
                  <span className="font-medium">{m.payment_percentage}%</span>
                </div>
              ))}
            </div>
            <button onClick={() => setConfirm(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Use Standard Template
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
      <p className="text-sm font-semibold text-indigo-900 mb-2">Confirm template setup?</p>
      <p className="text-xs text-indigo-700 mb-4">
        This will create 9 milestones for this project. You can edit them individually after setup.
      </p>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirm(false)}
          className="px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-100">
          Cancel
        </button>
        <button type="button" onClick={handleSetup} disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Setting up...' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
