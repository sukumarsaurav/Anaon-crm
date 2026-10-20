'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBroadcast, sendBroadcast } from '@/lib/whatsapp/actions'
import type { WaTemplate } from '@/types/whatsapp'
import { STAGE_ORDER, STAGE_CONFIG } from '@/types/leads'

interface Props {
  templates: WaTemplate[]
}

// Lost/won leads are left out: a broadcast to them is mostly noise and opt-out risk.
const STAGES = STAGE_ORDER.filter((s) => s !== 'closed_won' && s !== 'not_interested')

export default function BroadcastForm({ templates }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [sendNow, setSendNow] = useState(false)

  function toggleStage(stage: string) {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const audienceFilters = {
      stage: selectedStages.length ? selectedStages : undefined,
      city: (formData.get('city') as string)?.trim() || undefined,
    }
    formData.set('audience_filters', JSON.stringify(audienceFilters))
    // datetime-local has no zone; send the instant the user meant, in their own zone.
    const scheduled = formData.get('scheduled_at') as string
    formData.set('scheduled_at', scheduled && !sendNow ? new Date(scheduled).toISOString() : '')
    setError(null)

    startTransition(async () => {
      const result = await createBroadcast(formData)
      if (!result.success) {
        setError(result.error ?? 'Failed to create broadcast')
        return
      }
      if (sendNow && result.id) {
        const sent = await sendBroadcast(result.id)
        if (!sent.success) {
          setError(`Saved, but not sent: ${sent.error}`)
          return
        }
      }
      router.push(result.id ? `/whatsapp/broadcasts/${result.id}` : '/whatsapp/broadcasts')
    })
  }

  const approvedTemplates = templates.filter((t) => t.status === 'approved' && t.is_active)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label htmlFor="broadcastform-name" className="block text-sm font-medium text-slate-700 mb-1">Broadcast Name</label>
        <input id="broadcastform-name"
          name="name"
          required
          placeholder="May 2025 Follow-up Campaign"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="broadcastform-template-id" className="block text-sm font-medium text-slate-700 mb-1">Template</label>
        <select id="broadcastform-template-id"
          name="template_id"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Select a template...</option>
          {approvedTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.display_name} ({t.category})</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">Marketing templates skip contacts who replied STOP; utility templates reach everyone.</p>
        {approvedTemplates.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No approved templates available. Create and get templates approved first.</p>
        )}
      </div>

      <div>
        <span id="broadcast-stage-label" className="block text-sm font-medium text-slate-700 mb-2">Audience — Lead Stage</span>
        <div role="group" aria-labelledby="broadcast-stage-label" className="flex flex-wrap gap-2">
          {STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => toggleStage(stage)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${
                selectedStages.includes(stage)
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {STAGE_CONFIG[stage]?.label ?? stage.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {selectedStages.length === 0 ? 'No filter — all leads will receive this' : `${selectedStages.length} stage(s) selected`}
        </p>
      </div>

      <div>
        <label htmlFor="broadcastform-city" className="block text-sm font-medium text-slate-700 mb-1">Audience — City (optional)</label>
        <input id="broadcastform-city"
          name="city"
          placeholder="Jaipur"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="text-xs text-slate-400 mt-1">Leads who opted out (replied STOP) are skipped automatically.</p>
      </div>

      <div>
        <label htmlFor="broadcastform-scheduled-at" className="block text-sm font-medium text-slate-700 mb-1">Schedule (optional)</label>
        <input id="broadcastform-scheduled-at"
          name="scheduled_at"
          type="datetime-local"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="text-xs text-slate-400 mt-1">Set a time and press Save to schedule it; leave empty to save a draft.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          onClick={() => setSendNow(false)}
          disabled={isPending}
          className="px-6 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="submit"
          onClick={() => setSendNow(true)}
          disabled={isPending || approvedTemplates.length === 0}
          className="px-6 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-40"
        >
          {isPending ? 'Processing...' : 'Create & Send Now'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 text-slate-600 text-sm hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
