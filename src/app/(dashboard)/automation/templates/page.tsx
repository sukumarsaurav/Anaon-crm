import Link from 'next/link'
import { AUTOMATION_TEMPLATES, TRIGGER_OPTIONS, ACTION_OPTIONS } from '@/types/automation'
import InstallTemplateButton from '@/components/automation/InstallTemplateButton'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CATEGORY_ORDER = ['Lead', 'Sales', 'Finance', 'Construction', 'Client', 'Broker']

function getCategory(triggerValue: string) {
  return TRIGGER_OPTIONS.find(t => t.value === triggerValue)?.category ?? 'Other'
}

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: installed } = await supabase
    .from('automations')
    .select('template_key')
    .not('template_key', 'is', null)

  const installedKeys = new Set((installed ?? []).map(r => r.template_key))

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = AUTOMATION_TEMPLATES.filter(t => getCategory(t.trigger_event) === cat)
    return acc
  }, {} as Record<string, typeof AUTOMATION_TEMPLATES>)

  const getTriggerLabel = (v: string) => TRIGGER_OPTIONS.find(t => t.value === v)?.label ?? v
  const getActionLabel = (v: string) => ACTION_OPTIONS.find(a => a.value === v)?.label ?? v

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/automation" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {AUTOMATION_TEMPLATES.length} pre-built templates · {installedKeys.size} installed
          </p>
        </div>
      </div>

      {CATEGORY_ORDER.map(category => {
        const templates = grouped[category] ?? []
        if (!templates.length) return null
        return (
          <div key={category}>
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-3">
              {category}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.map(tpl => {
                const isInstalled = installedKeys.has(tpl.template_key)
                return (
                  <div key={tpl.template_key}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap size={14} className="text-indigo-500 shrink-0" />
                          <p className="font-semibold text-slate-900 text-sm">{tpl.name}</p>
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-slate-500">{tpl.description}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {isInstalled
                          ? <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg">Installed</span>
                          : <InstallTemplateButton templateKey={tpl.template_key!} />
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        {getTriggerLabel(tpl.trigger_event)}
                      </span>
                      <span className="text-slate-300">→</span>
                      {(tpl.delay_value ?? 0) > 0 && (
                        <>
                          <span className="text-amber-600">after {tpl.delay_value} {tpl.delay_unit}</span>
                          <span className="text-slate-300">→</span>
                        </>
                      )}
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        {getActionLabel(tpl.action_type)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
