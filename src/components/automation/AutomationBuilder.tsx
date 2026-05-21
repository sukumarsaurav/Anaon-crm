'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAutomation, updateAutomation } from '@/lib/automation/actions'
import {
  TRIGGER_OPTIONS, ACTION_OPTIONS, CONDITION_FIELDS, LEAD_STAGES,
  type TriggerEvent, type ActionType, type AutomationCondition, type AutomationActionPayload, type Automation
} from '@/types/automation'
import { Plus, X } from 'lucide-react'

interface Props {
  automation?: Automation
  templates?: { id: string; name: string }[]
  advisors?: { id: string; full_name: string }[]
  whatsappTemplates?: { name: string }[]
}

const GROUPED_TRIGGERS = TRIGGER_OPTIONS.reduce((acc, t) => {
  ;(acc[t.category] ??= []).push(t)
  return acc
}, {} as Record<string, typeof TRIGGER_OPTIONS>)

export default function AutomationBuilder({ automation, advisors = [], whatsappTemplates = [] }: Props) {
  const router = useRouter()

  const [trigger, setTrigger] = useState<TriggerEvent>(automation?.trigger_event ?? 'lead_created')
  const [action, setAction] = useState<ActionType>(automation?.action_type ?? 'send_notification')
  const [conditions, setConditions] = useState<AutomationCondition[]>(automation?.conditions ?? [])
  const [payload, setPayload] = useState<AutomationActionPayload>(automation?.action_payload ?? {})
  const [delayValue, setDelayValue] = useState(automation?.delay_value ?? 0)
  const [delayUnit, setDelayUnit] = useState(automation?.delay_unit ?? 'minutes')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addCondition() {
    setConditions(c => [...c, { field: 'source', operator: 'equals', value: '' }])
  }
  function removeCondition(i: number) {
    setConditions(c => c.filter((_, idx) => idx !== i))
  }
  function updateCondition(i: number, partial: Partial<AutomationCondition>) {
    setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, ...partial } : cond))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('trigger_event', trigger)
    fd.set('action_type', action)
    fd.set('conditions', JSON.stringify(conditions))
    fd.set('action_payload', JSON.stringify(payload))
    fd.set('delay_value', String(delayValue))
    fd.set('delay_unit', delayUnit)

    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = automation
        ? await updateAutomation(automation.id, fd)
        : await createAutomation(fd)
      setLoading(false)
      if (!result.success) setError(result.error ?? 'Failed')
      else router.push('/automation')
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400'
  const selectCls = `${inputCls} bg-white`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-900">Basic Info</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input name="name" required defaultValue={automation?.name ?? ''}
            placeholder="e.g. Welcome New Facebook Lead"
            className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input name="description" defaultValue={automation?.description ?? ''}
            placeholder="What does this automation do?"
            className={inputCls} />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" name="is_active" value="true"
            defaultChecked={automation?.is_active ?? true}
            className="w-4 h-4 rounded text-indigo-600" />
          <label htmlFor="is_active" className="text-sm text-slate-700">Active (fires immediately when conditions match)</label>
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="font-semibold text-slate-900">Trigger — When should this fire?</h3>
        </div>
        <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerEvent)} className={selectCls}>
          {Object.entries(GROUPED_TRIGGERS).map(([cat, opts]) => (
            <optgroup key={cat} label={cat}>
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Conditions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="font-semibold text-slate-900">Conditions (optional) — Filter when to fire</h3>
          </div>
          <button type="button" onClick={addCondition}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            <Plus size={13} /> Add Condition
          </button>
        </div>
        {conditions.length === 0 && (
          <p className="text-sm text-slate-400 italic">No conditions — fires for all {trigger.replace(/_/g, ' ')} events</p>
        )}
        {conditions.map((cond, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <select value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none flex-1 min-w-32">
              {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={cond.operator} onChange={e => updateCondition(i, { operator: e.target.value as AutomationCondition['operator'] })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none">
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="greater_than">greater than</option>
              <option value="less_than">less than</option>
            </select>
            {cond.field === 'stage' ? (
              <select value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none flex-1 min-w-32">
                <option value="">Select stage</option>
                {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            ) : (
              <input value={cond.value} onChange={e => updateCondition(i, { value: e.target.value })}
                placeholder="value" className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none flex-1 min-w-32" />
            )}
            <button type="button" onClick={() => removeCondition(i)}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Delay */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="font-semibold text-slate-900">Delay (optional)</h3>
        </div>
        <div className="flex items-center gap-3">
          <input type="number" value={delayValue} onChange={e => setDelayValue(parseInt(e.target.value) || 0)}
            min="0" max="365"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
          <select value={delayUnit} onChange={e => setDelayUnit(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
          {delayValue === 0 && <span className="text-sm text-slate-400">Immediate</span>}
        </div>
      </div>

      {/* Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="font-semibold text-slate-900">Action — What to do?</h3>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Action Type</label>
          <select value={action} onChange={e => { setAction(e.target.value as ActionType); setPayload({}) }} className={selectCls}>
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Payload fields per action type */}
        {action === 'send_whatsapp' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Template Name</label>
              {whatsappTemplates.length > 0 ? (
                <select value={payload.template_name ?? ''} onChange={e => setPayload(p => ({ ...p, template_name: e.target.value }))} className={selectCls}>
                  <option value="">Select template</option>
                  {whatsappTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              ) : (
                <input value={payload.template_name ?? ''} onChange={e => setPayload(p => ({ ...p, template_name: e.target.value }))}
                  placeholder="e.g. welcome_lead" className={inputCls} />
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Recipient</label>
              <select value={payload.recipient ?? 'lead'} onChange={e => setPayload(p => ({ ...p, recipient: e.target.value as any }))} className={selectCls}>
                <option value="lead">Lead</option>
                <option value="client">Client</option>
                <option value="advisor">Advisor</option>
              </select>
            </div>
          </div>
        )}

        {action === 'send_notification' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Title</label>
              <input value={payload.notification_title ?? ''} onChange={e => setPayload(p => ({ ...p, notification_title: e.target.value }))}
                placeholder="e.g. New Lead Assigned" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Message (use {'{{lead_name}}'}, {'{{client_name}}'})</label>
              <textarea value={payload.notification_body ?? ''} onChange={e => setPayload(p => ({ ...p, notification_body: e.target.value }))}
                rows={2} placeholder="e.g. You have a new lead: {{lead_name}}" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Notify Roles</label>
              <div className="flex gap-3 flex-wrap">
                {['admin', 'manager', 'sales_advisor', 'hr'].map(role => (
                  <label key={role} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" checked={(payload.notify_roles ?? []).includes(role)}
                      onChange={e => setPayload(p => ({
                        ...p,
                        notify_roles: e.target.checked
                          ? [...(p.notify_roles ?? []), role]
                          : (p.notify_roles ?? []).filter(r => r !== role)
                      }))}
                      className="rounded text-indigo-600" />
                    {role.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {action === 'create_followup' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Follow-up Note</label>
              <input value={payload.followup_note ?? ''} onChange={e => setPayload(p => ({ ...p, followup_note: e.target.value }))}
                placeholder="e.g. Auto follow-up after visit" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Schedule After (hours)</label>
              <input type="number" value={payload.followup_hours ?? 24} min="1"
                onChange={e => setPayload(p => ({ ...p, followup_hours: parseInt(e.target.value) }))}
                className={inputCls} />
            </div>
          </div>
        )}

        {action === 'change_lead_stage' && (
          <div>
            <label className="block text-xs text-slate-600 mb-1">New Stage</label>
            <select value={payload.new_stage ?? ''} onChange={e => setPayload(p => ({ ...p, new_stage: e.target.value }))} className={selectCls}>
              <option value="">Select stage</option>
              {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        )}

        {action === 'assign_to_advisor' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Assignment Mode</label>
              <select value={payload.assignment_mode ?? 'round_robin'} onChange={e => setPayload(p => ({ ...p, assignment_mode: e.target.value as any }))} className={selectCls}>
                <option value="round_robin">Round Robin</option>
                <option value="specific">Specific Advisor</option>
              </select>
            </div>
            {payload.assignment_mode === 'specific' && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Advisor</label>
                <select value={payload.advisor_id ?? ''} onChange={e => setPayload(p => ({ ...p, advisor_id: e.target.value }))} className={selectCls}>
                  <option value="">Select advisor</option>
                  {advisors.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {action === 'send_email' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Subject</label>
              <input value={payload.email_subject ?? ''} onChange={e => setPayload(p => ({ ...p, email_subject: e.target.value }))}
                placeholder="e.g. Payment Reminder" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Body</label>
              <textarea value={payload.email_body ?? ''} onChange={e => setPayload(p => ({ ...p, email_body: e.target.value }))}
                rows={4} placeholder="Email content..." className={inputCls} />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.push('/automation')}
          className="px-5 py-3 border border-slate-300 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Saving...' : automation ? 'Update Automation' : 'Create Automation'}
        </button>
      </div>
    </form>
  )
}
