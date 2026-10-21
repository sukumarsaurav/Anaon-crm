'use client'

import { useState, useTransition } from 'react'
import { FlaskConical, Send, CheckCircle2, XCircle } from 'lucide-react'
import { listTestRecords, testAutomation } from '@/lib/automation/actions'
import Button from '@/components/ui/Button'
import type { TriggerEvent } from '@/types/automation'

type Result = Awaited<ReturnType<typeof testAutomation>>

interface Props {
  trigger: TriggerEvent
  automationId?: string
  /** For the builder: the unsaved form, so changes can be tested before saving. */
  getDraft?: () => FormData
}

const LABELS: Record<string, string> = {
  channel: 'Channel', to: 'To', template: 'Template', category: 'Category', message: 'Message', subject: 'Subject',
  recipients: 'Notifies', title: 'Title', change: 'Change', lead: 'Lead', from: 'From', at: 'When', note: 'Note',
  mode: 'Mode', sentTo: 'Sent to',
}

/**
 * Try the automation on a real record: see whether the conditions pass and exactly what it would do,
 * or send the message to yourself. Nothing is changed and nothing reaches the customer.
 */
export default function TestRunPanel({ trigger, automationId, getDraft }: Props) {
  const [records, setRecords] = useState<{ id: string; label: string }[] | null>(null)
  const [kind, setKind] = useState('record')
  const [recordId, setRecordId] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [running, startRun] = useTransition()

  function open() {
    setLoadError(null)
    startLoad(async () => {
      const r = await listTestRecords(trigger)
      if (!r.success) { setLoadError(r.error); return }
      setKind(r.kind)
      setRecords(r.records)
      setRecordId(r.records[0]?.id ?? '')
    })
  }

  function run(mode: 'preview' | 'self') {
    setResult(null)
    startRun(async () => setResult(await testAutomation({ automationId, recordId, mode }, getDraft?.())))
  }

  if (!records) {
    return (
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={open} loading={loading}><FlaskConical size={14} /> Test on a real record</Button>
        {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
      </div>
    )
  }

  const r = result?.success ? result.result : null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2"><FlaskConical size={15} /> Test run</h3>
        <p className="text-xs text-slate-500">Nothing is saved and nothing reaches the {kind}.</p>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-slate-500">No {kind} records to test with yet.</p>
      ) : (
        <div className="flex items-end gap-2 flex-wrap">
          <label className="flex-1 min-w-60 text-xs text-slate-600">Try it on this {kind}
            <select value={recordId} onChange={(e) => { setRecordId(e.target.value); setResult(null) }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {records.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <Button type="button" size="sm" onClick={() => run('preview')} loading={running}>Preview</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => run('self')} disabled={running}
            title="Sends the WhatsApp / email / notification to you only"><Send size={13} /> Send test to me</Button>
        </div>
      )}

      {result && !result.success && <p role="alert" className="text-sm text-red-600">{result.error}</p>}
      {r && (
        <div className="space-y-3 text-sm">
          {r.conditions.length > 0 && (
            <ul className="space-y-1">
              {r.conditions.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {c.pass ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-red-500" />}
                  <span className="text-slate-700">{c.field} {c.operator.replace('_', ' ')} “{c.value}”</span>
                  <span className="text-xs text-slate-500">(this record: {c.actual ?? 'empty'})</span>
                </li>
              ))}
            </ul>
          )}
          <p className={`text-sm font-medium ${r.wouldRun ? 'text-emerald-700' : 'text-amber-700'}`}>
            {r.wouldRun ? 'The conditions match — this automation would run for this record.' : 'The conditions don’t match — it would not run for this record. Below is what it would do if they did.'}
          </p>
          {r.success ? (
            <dl className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {Object.entries(r.preview ?? {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-xs text-slate-500">{LABELS[k] ?? k}</dt>
                  <dd className="text-slate-800 whitespace-pre-wrap break-words">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p role="alert" className="text-sm text-red-600">It would fail: {r.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
