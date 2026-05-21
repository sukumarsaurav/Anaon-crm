'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Clock, MessageSquare, Hash, Calendar } from 'lucide-react'
import { saveAutoReplyRule } from '@/lib/whatsapp/actions'
import type { AutoReplyRule } from '@/types/whatsapp'

const TRIGGER_CONFIG: Record<AutoReplyRule['trigger_type'], { label: string; icon: React.ElementType; color: string; bg: string }> = {
  office_hours:      { label: 'Office Hours',    icon: Clock,         color: 'text-blue-700',   bg: 'bg-blue-50' },
  new_contact:       { label: 'New Contact',      icon: MessageSquare, color: 'text-green-700',  bg: 'bg-green-50' },
  keyword:           { label: 'Keyword Match',    icon: Hash,          color: 'text-purple-700', bg: 'bg-purple-50' },
  after_site_visit:  { label: 'After Site Visit', icon: Calendar,      color: 'text-amber-700',  bg: 'bg-amber-50' },
}

interface Props {
  rules: AutoReplyRule[]
}

export default function AutoReplyRuleList({ rules: initialRules }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function handleToggle(rule: AutoReplyRule) {
    const fd = new FormData()
    fd.set('id', rule.id)
    fd.set('name', rule.name)
    fd.set('is_active', String(!rule.is_active))
    fd.set('priority', String(rule.priority))
    fd.set('trigger_type', rule.trigger_type)
    fd.set('trigger_config', JSON.stringify(rule.trigger_config))
    fd.set('response_type', rule.response_type)
    fd.set('response_text', rule.response_text ?? '')
    fd.set('response_template_id', rule.response_template_id ?? '')
    fd.set('response_buttons', JSON.stringify(rule.response_buttons))
    startTransition(async () => {
      await saveAutoReplyRule(fd)
      router.refresh()
    })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const triggerType = data.get('trigger_type') as AutoReplyRule['trigger_type']

    let triggerConfig: Record<string, unknown> = {}
    if (triggerType === 'keyword') {
      const kw = (data.get('keywords') as string ?? '').split(',').map(s => s.trim()).filter(Boolean)
      triggerConfig = { keywords: kw, match_mode: data.get('match_mode') ?? 'any' }
    } else if (triggerType === 'office_hours') {
      triggerConfig = { when: data.get('when') ?? 'outside' }
    }

    const fd = new FormData()
    fd.set('name', data.get('name') as string)
    fd.set('is_active', 'true')
    fd.set('priority', data.get('priority') as string)
    fd.set('trigger_type', triggerType)
    fd.set('trigger_config', JSON.stringify(triggerConfig))
    fd.set('response_type', 'text')
    fd.set('response_text', data.get('response_text') as string)
    fd.set('response_buttons', '[]')

    setFormLoading(true)
    setFormError(null)
    const result = await saveAutoReplyRule(fd)
    setFormLoading(false)
    if (!result.success) {
      setFormError(result.error ?? 'Failed to save')
    } else {
      setShowForm(false)
      form.reset()
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* Rules list */}
      {initialRules.length === 0 && !showForm && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No auto-reply rules yet</p>
          <p className="text-sm text-gray-400 mt-1">Add a rule to automatically respond to inbound messages</p>
        </div>
      )}

      {initialRules.map((rule) => {
        const cfg = TRIGGER_CONFIG[rule.trigger_type]
        const Icon = cfg.icon
        return (
          <div key={rule.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
              <Icon size={16} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-gray-900">{rule.name}</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-gray-400">Priority {rule.priority}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{rule.response_text ?? '(template/interactive response)'}</p>
              {rule.trigger_type === 'keyword' && Array.isArray(rule.trigger_config.keywords) && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(rule.trigger_config.keywords as string[]).map((kw) => (
                    <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => handleToggle(rule)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                rule.is_active ? 'bg-green-500' : 'bg-gray-200'
              }`}
              title={rule.is_active ? 'Disable' : 'Enable'}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        )
      })}

      {/* Add rule button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 w-full px-4 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
        >
          <Plus size={16} /> Add Auto-Reply Rule
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">New Auto-Reply Rule</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name <span className="text-red-500">*</span></label>
                <input name="name" required placeholder="e.g. After-hours greeting"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger <span className="text-red-500">*</span></label>
                <select name="trigger_type" required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="new_contact">New Contact</option>
                  <option value="office_hours">Office Hours</option>
                  <option value="keyword">Keyword Match</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input name="priority" type="number" defaultValue="10" min="1" max="100"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords <span className="text-xs text-gray-400">(comma-separated, for keyword trigger)</span>
                </label>
                <input name="keywords" placeholder="price, cost, how much"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reply Message <span className="text-red-500">*</span></label>
                <textarea name="response_text" required rows={3}
                  placeholder="Hi! Thanks for reaching out to ANON INDIA. Our team will get back to you shortly."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
              </div>
            </div>

            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{formError}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={formLoading}
                className="flex-1 py-2.5 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 disabled:opacity-50">
                {formLoading ? 'Saving...' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
