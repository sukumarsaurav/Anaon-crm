'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleTemplateActive, submitTemplateForApproval, updateTemplate, resubmitRejectedTemplate, deleteTemplate } from '@/lib/whatsapp/actions'
import { namedVariables } from '@/lib/whatsapp/template-render'
import { sampleValueFor } from '@/lib/whatsapp/template-render'
import type { WaTemplate } from '@/types/whatsapp'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Props {
  template: WaTemplate
  canSubmit?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50' },
  pending_approval: { label: 'In review', color: 'text-amber-700', bg: 'bg-amber-50' },
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50' },
  disabled: { label: 'Disabled', color: 'text-slate-500', bg: 'bg-slate-100' },
}

export default function TemplateCard({ template, canSubmit }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(template.body)
  const [editName, setEditName] = useState(template.display_name)
  const [editFooter, setEditFooter] = useState(template.footer ?? '')
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

  const editable = template.status === 'draft' || template.status === 'rejected'
  const deletable = template.status !== 'disabled'

  function handleSaveEdit() {
    setSubmitMsg(null)
    const fd = new FormData()
    fd.set('display_name', editName)
    fd.set('body', editBody)
    fd.set('footer', editFooter)
    startTransition(async () => {
      // A rejected template already exists at WhatsApp, so it is edited there and re-reviewed;
      // a draft only exists in the CRM.
      const r = template.status === 'rejected'
        ? await resubmitRejectedTemplate(template.id, fd)
        : await updateTemplate(template.id, fd)
      setSubmitMsg(r.success
        ? (template.status === 'rejected' ? 'Resubmitted — WhatsApp is reviewing it' : 'Saved')
        : r.error ?? 'Could not save')
      if (r.success) { setEditing(false); router.refresh() }
    })
  }

  const askConfirm = useConfirm()
  async function handleDelete() {
    if (!(await askConfirm({ title: 'Delete template', message: `Delete template "${template.display_name}"? This also removes it from WhatsApp if it was submitted.` }))) return
    setSubmitMsg(null)
    startTransition(async () => {
      const r = await deleteTemplate(template.id)
      if (r.success) router.refresh()
      else setSubmitMsg(r.error ?? 'Could not delete')
    })
  }

  function handleToggle() {
    startTransition(async () => { await toggleTemplateActive(template.id, !template.is_active) })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">{template.display_name}</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{template.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.bg}`}>
            {statusCfg.label}
          </span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
            {template.category}
          </span>
        </div>
      </div>

      {template.rejection_reason && template.status !== 'approved' && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1 mb-2">{template.rejection_reason}</p>
      )}

      {/* Body preview */}
      <div className="bg-slate-50 rounded-lg p-3 mb-3">
        <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{template.body}</p>
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{template.language.toUpperCase()}</span>
          {editable && !editing && (
            <button onClick={() => setEditing(true)} disabled={isPending} className="text-xs text-blue-600 hover:underline disabled:opacity-40">Edit</button>
          )}
          {deletable && (
            <button onClick={handleDelete} disabled={isPending} className="text-xs text-red-600 hover:underline disabled:opacity-40">Delete</button>
          )}
        </div>
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
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {template.is_active ? 'Active' : 'Inactive'}
          </button>
        )}
      </div>
      {showSubmit && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs text-slate-500">Sample values WhatsApp&apos;s reviewers will see:</p>
          {template.variable_names.map((v) => (
            <label key={v} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full shrink-0">{`{{${v}}}`}</span>
              <input
                value={examples[v] ?? ''}
                onChange={(e) => setExamples((x) => ({ ...x, [v]: e.target.value }))}
                className="flex-1 min-w-0 px-2 py-1 border border-slate-300 rounded-md text-sm"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowSubmit(false)} className="text-xs px-3 py-1 text-slate-600">Cancel</button>
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
      {editing && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
          <input aria-label="Display name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Display name"
            className="w-full px-2 py-1 border border-slate-300 rounded-md text-sm" />
          <textarea aria-label="Template body" value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={5}
            className="w-full px-2 py-1 border border-slate-300 rounded-md text-sm" />
          {namedVariables(editBody).length > 0 && (
            <p className="text-xs text-slate-500">Variables: {namedVariables(editBody).map((v) => `{{${v}}}`).join(', ')}</p>
          )}
          <input aria-label="Footer (optional)" value={editFooter} onChange={(e) => setEditFooter(e.target.value)} placeholder="Footer (optional)"
            className="w-full px-2 py-1 border border-slate-300 rounded-md text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 text-slate-600">Cancel</button>
            <button onClick={handleSaveEdit} disabled={isPending || !editBody.trim()}
              className="text-xs px-3 py-1 rounded-lg font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-40">
              {isPending ? 'Saving…' : template.status === 'rejected' ? 'Save & resubmit' : 'Save'}
            </button>
          </div>
        </div>
      )}
      {submitMsg && <p className="mt-2 text-xs text-slate-600">{submitMsg}</p>}
    </div>
  )
}
