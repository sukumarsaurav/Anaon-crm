'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logMilestoneDelay } from '@/lib/construction/actions'
import type { ConstructionMilestone } from '@/types/construction'

interface Props {
  milestone: ConstructionMilestone
  projectId: string
  onClose: () => void
}

export default function MilestoneDelayForm({ milestone, projectId, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await logMilestoneDelay(milestone.id, projectId, formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to log delay')
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-4">
      <h4 className="text-sm font-semibold text-red-800">Log Delay</h4>
      <p className="text-xs text-red-600">
        This will flag the milestone as delayed. Provide the reason and a revised expected date.
      </p>

      <div>
        <label className="block text-xs font-medium text-red-700 mb-1">Reason for Delay <span className="text-red-500">*</span></label>
        <textarea name="delay_reason" required rows={3}
          defaultValue={milestone.delay_reason ?? ''}
          placeholder="e.g. Contractor delay, monsoon weather, material shortage..."
          className="w-full text-sm rounded-lg border border-red-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
      </div>

      <div>
        <label className="block text-xs font-medium text-red-700 mb-1">Revised Expected Date</label>
        <input type="date" name="revised_expected_date"
          defaultValue={milestone.revised_expected_date ?? ''}
          className="w-full text-sm rounded-lg border border-red-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
      </div>

      {error && <p className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-100">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
          {loading ? 'Saving...' : 'Flag as Delayed'}
        </button>
      </div>
    </form>
  )
}
