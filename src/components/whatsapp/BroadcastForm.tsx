'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBroadcast, sendBroadcast, previewBroadcastAudience } from '@/lib/whatsapp/actions'
import type { BroadcastAudiencePreview, WaTemplate } from '@/types/whatsapp'
import { STAGE_ORDER, STAGE_CONFIG, SOURCE_LABELS } from '@/types/leads'

interface Props {
  templates: WaTemplate[]
  projects: { id: string; name: string }[]
}

const INPUT = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const DEFAULT_EXCLUDED = ['closed_won', 'not_interested']
const SOURCES = Object.entries(SOURCE_LABELS) as [string, string][]

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${
        on ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

export default function BroadcastForm({ templates, projects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [templateId, setTemplateId] = useState('')
  const [stages, setStages] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [projectId, setProjectId] = useState('')
  const [city, setCity] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')

  const [preview, setPreview] = useState<BroadcastAudiencePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const filters = useMemo(() => ({
    stage: stages.length ? stages : undefined,
    source: sources.length ? sources : undefined,
    project_id: projectId || undefined,
    city: city.trim() || undefined,
    budget_min: budgetMin ? Number(budgetMin) : undefined,
    budget_max: budgetMax ? Number(budgetMax) : undefined,
  }), [stages, sources, projectId, city, budgetMin, budgetMax])

  // Live audience size, so nobody sends blind. Debounced; nothing is saved.
  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setPreviewing(true)
      const r = await previewBroadcastAudience(filters, templateId)
      if (cancelled) return
      setPreviewing(false)
      if (r.success) { setPreview(r.preview ?? null); setPreviewError(null) }
      else { setPreview(null); setPreviewError(r.error ?? 'Could not count the audience') }
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [filters, templateId])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Which button submitted, read from the event itself (not state set by its onClick).
    const sendNow = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'send'
    const formData = new FormData(e.currentTarget)
    formData.set('template_id', templateId)
    formData.set('audience_filters', JSON.stringify(filters))
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
  const selectedTemplate = approvedTemplates.find((t) => t.id === templateId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label htmlFor="broadcastform-name" className="block text-sm font-medium text-slate-700 mb-1">Broadcast Name</label>
        <input id="broadcastform-name" name="name" required placeholder="May 2025 Follow-up Campaign" className={INPUT} />
      </div>

      <div>
        <label htmlFor="broadcastform-template-id" className="block text-sm font-medium text-slate-700 mb-1">Template</label>
        <select id="broadcastform-template-id" name="template_id" required value={templateId}
          onChange={(e) => { setTemplateId(e.target.value); if (!e.target.value) setPreview(null) }} className={INPUT}>
          <option value="">Select a template...</option>
          {approvedTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.display_name} ({t.category})</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">Marketing templates skip contacts who replied STOP; utility templates reach them. Leads not opted in to WhatsApp are always skipped.</p>
        {approvedTemplates.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No approved templates available. Create and get templates approved first.</p>
        )}
        {selectedTemplate?.body && (
          <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap">{selectedTemplate.body}</p>
        )}
      </div>

      <div>
        <span id="broadcast-stage-label" className="block text-sm font-medium text-slate-700 mb-2">Audience — Lead Stage</span>
        <div role="group" aria-labelledby="broadcast-stage-label" className="flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => (
            <Chip key={stage} on={stages.includes(stage)} onClick={() => setStages((p) => toggle(p, stage))}>
              {STAGE_CONFIG[stage]?.label ?? stage.replace(/_/g, ' ')}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {stages.length === 0
            ? `No stage picked — every stage except ${DEFAULT_EXCLUDED.map((s) => STAGE_CONFIG[s as keyof typeof STAGE_CONFIG]?.label ?? s).join(' and ')}`
            : `${stages.length} stage(s) selected`}
        </p>
      </div>

      <div>
        <span id="broadcast-source-label" className="block text-sm font-medium text-slate-700 mb-2">Audience — Lead Source (optional)</span>
        <div role="group" aria-labelledby="broadcast-source-label" className="flex flex-wrap gap-2">
          {SOURCES.map(([value, label]) => (
            <Chip key={value} on={sources.includes(value)} onClick={() => setSources((p) => toggle(p, value))}>{label}</Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="broadcastform-project" className="block text-sm font-medium text-slate-700 mb-1">Audience — Project (optional)</label>
          <select id="broadcastform-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={INPUT}>
            <option value="">Any project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="broadcastform-city" className="block text-sm font-medium text-slate-700 mb-1">Audience — City (optional)</label>
          <input id="broadcastform-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Jaipur" className={INPUT} />
        </div>
        <div>
          <label htmlFor="broadcastform-budget-min" className="block text-sm font-medium text-slate-700 mb-1">Budget at least (₹)</label>
          <input id="broadcastform-budget-min" type="number" min="0" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="2500000" className={INPUT} />
        </div>
        <div>
          <label htmlFor="broadcastform-budget-max" className="block text-sm font-medium text-slate-700 mb-1">Budget at most (₹)</label>
          <input id="broadcastform-budget-max" type="number" min="0" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="7500000" className={INPUT} />
        </div>
      </div>

      <div aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        {!templateId ? (
          <span className="text-slate-500">Pick a template to see how many people this reaches.</span>
        ) : previewError ? (
          <span className="text-red-600">{previewError}</span>
        ) : preview ? (
          <div className={previewing ? 'opacity-60' : ''}>
            <p className="font-medium text-slate-900">
              {preview.sendable.toLocaleString('en-IN')} will receive this
              <span className="font-normal text-slate-500"> of {preview.matched.toLocaleString('en-IN')} matching numbers</span>
            </p>
            {(preview.optedOut > 0 || preview.noOptIn > 0 || preview.missingVariables > 0) && (
              <p className="text-xs text-slate-500 mt-1">
                Skipped: {[
                  preview.optedOut && `${preview.optedOut} replied STOP`,
                  preview.noOptIn && `${preview.noOptIn} not opted in`,
                  preview.missingVariables && `${preview.missingVariables} missing a template value`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        ) : (
          <span className="text-slate-500">Counting…</span>
        )}
      </div>

      <div>
        <label htmlFor="broadcastform-scheduled-at" className="block text-sm font-medium text-slate-700 mb-1">Schedule (optional)</label>
        <input id="broadcastform-scheduled-at" name="scheduled_at" type="datetime-local" className={INPUT} />
        <p className="text-xs text-slate-400 mt-1">Set a time and press Save to schedule it (it starts within 5 minutes of that time); leave empty to save a draft.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          value="save"
          disabled={isPending}
          className="px-6 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="submit"
          value="send"
          disabled={isPending || approvedTemplates.length === 0 || preview?.sendable === 0}
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
