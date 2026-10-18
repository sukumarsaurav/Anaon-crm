'use client'

import { useState, useTransition } from 'react'
import { toggleTemplateActive, submitTemplateForApproval } from '@/lib/whatsapp/actions'
import { sampleValueFor } from '@/lib/whatsapp/template-render'
import type { WaTemplate } from '@/types/whatsapp'

interface Props {
  template: WaTemplate
  canSubmit?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50' },
  pending_approval: { label: 'In review', color: 'text-amber-700', bg: 'bg-amber-50' },
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50' },
  disabled: { label: 'Disabled', color: 'text-gray-500', bg: 'bg-gray-100' },
}

export default function TemplateCard({ template, canSubmit }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showSubmit, setShowSubmit] = useState(false)
  const [examples, setExamples] = useState<Record<string, string>>(
    () => Object.fromEntries(template.variable_names.map((v) => [v, sampleValueFor(v)])),
  )
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  const statusCfg = STATUS_CONFIG[template.status] ?? STATUS_CONFIG.draft
  const submittable = canSubmit && (template.status === 'draft' || template.status === 'rejected') && template.category !== 'authentication'

  function handleSubmit() {
    setSubmitMsg(null)
    startTransition(async () => {
      const r = await submitTemplateForApproval(template.id, examples)
      setSubmitMsg(r.success ? 'Submitted — WhatsApp is reviewing it' : r.error ?? 'Submission failed')
      if (r.success) setShowSubmit(false)
    })
  }

  function handleToggle() {
    startTransition(async () => { await toggleTemplateActive(template.id, !template.is_active) })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{template.display_name}</h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{template.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.bg}`}>
            {statusCfg.label}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
            {template.category}
          </span>
        </div>
      </div>

      {template.rejection_reason && template.status !== 'approved' && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1 mb-2">{template.rejection_reason}</p>
      )}

      {/* Body preview */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{template.body}</p>
      </div>

      {template.buttons?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.buttons.map((b, i) => (
            <span
              key={i}
              title={b.url ?? b.phone_number ?? undefined}
              className="text-xs border border-green-200 text-green-700 px-2 py-0.5 rounded-md"
            >
              {b.type === 'URL' ? '🔗 ' : b.type === 'PHONE_NUMBER' ? '📞 ' : ''}{b.text}
            </span>
          ))}
        </div>
      )}

      {/* Variables */}
      {template.variable_names.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.variable_names.map((v) => (
            <span key={v} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{template.language.toUpperCase()}</span>
        {submittable && !showSubmit && (
          <button
            onClick={() => (template.variable_names.length ? setShowSubmit(true) : handleSubmit())}
            disabled={isPending}
            className="text-xs px-3 py-1 rounded-lg font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-40"
          >
            {template.status === 'rejected' ? 'Resubmit for approval' : 'Submit for approval'}
          </button>
        )}
        {template.status === 'approved' && (
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              template.is_active
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {template.is_active ? 'Active' : 'Inactive'}
          </button>
        )}
      </div>
      {showSubmit && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs text-gray-500">Sample values WhatsApp&apos;s reviewers will see:</p>
          {template.variable_names.map((v) => (
            <label key={v} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full shrink-0">{`{{${v}}}`}</span>
              <input
                value={examples[v] ?? ''}
                onChange={(e) => setExamples((x) => ({ ...x, [v]: e.target.value }))}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowSubmit(false)} className="text-xs px-3 py-1 text-gray-600">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="text-xs px-3 py-1 rounded-lg font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-40"
            >
              {isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      )}
      {submitMsg && <p className="mt-2 text-xs text-gray-600">{submitMsg}</p>}
    </div>
  )
}
