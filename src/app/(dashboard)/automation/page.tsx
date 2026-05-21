export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAutomations, getAutomationLogs, getAutomationStats } from '@/lib/automation/queries'
import { TRIGGER_OPTIONS, ACTION_OPTIONS } from '@/types/automation'
import { formatDate } from '@/lib/utils'
import AutomationToggle from '@/components/automation/AutomationToggle'
import { Plus, Zap, CheckCircle2, XCircle, Clock, LayoutTemplate } from 'lucide-react'

export default async function AutomationPage() {
  const [automations, logs, stats] = await Promise.all([
    getAutomations(),
    getAutomationLogs(30),
    getAutomationStats(),
  ])

  const getTriggerLabel = (v: string) => TRIGGER_OPTIONS.find(t => t.value === v)?.label ?? v
  const getActionLabel = (v: string) => ACTION_OPTIONS.find(a => a.value === v)?.label ?? v

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats.active}/{stats.total} active · {stats.totalRuns.toLocaleString()} total runs · {stats.last7dFired} fired in last 7 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/automation/templates"
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50">
            <LayoutTemplate size={15} /> Templates
          </Link>
          <Link href="/automation/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
            <Plus size={15} /> New Automation
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Fired (7d)', value: stats.last7dFired, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Failed (7d)', value: stats.last7dFailed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon size={15} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Automation list */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-3">Your Automations</h2>
        {automations.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
            <Zap size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No automations yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Start with a template or build your own</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/automation/templates" className="px-4 py-2 border border-slate-300 text-sm text-slate-600 rounded-xl hover:bg-slate-50">Browse Templates</Link>
              <Link href="/automation/new" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">Build Custom</Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {automations.map(auto => (
              <div key={auto.id} className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/automation/${auto.id}`} className="font-semibold text-slate-900 text-sm hover:text-indigo-600 truncate">
                      {auto.name}
                    </Link>
                    {auto.template_key && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">template</span>
                    )}
                  </div>
                  {auto.description && <p className="text-xs text-slate-400 mb-1.5">{auto.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{getTriggerLabel(auto.trigger_event)}</span>
                    <span className="text-slate-300">→</span>
                    {(auto.delay_value ?? 0) > 0 && (
                      <>
                        <span className="text-amber-600">after {auto.delay_value} {auto.delay_unit}</span>
                        <span className="text-slate-300">→</span>
                      </>
                    )}
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{getActionLabel(auto.action_type)}</span>
                    {auto.run_count > 0 && <span className="ml-2 text-slate-400">{auto.run_count.toLocaleString()} runs</span>}
                    {auto.last_fired_at && <span className="text-slate-400">last {formatDate(auto.last_fired_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <AutomationToggle id={auto.id} isActive={auto.is_active} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Log */}
      {logs.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Recent Executions</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0">
                    {log.status === 'success'
                      ? <CheckCircle2 size={14} className="text-green-500" />
                      : log.status === 'failed'
                      ? <XCircle size={14} className="text-red-500" />
                      : <Clock size={14} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{log.automation?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">
                      {log.lead_name && `${log.lead_name} · `}
                      {log.automation?.action_type?.replace(/_/g, ' ')}
                      {log.error_message && ` · ${log.error_message}`}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{formatDate(log.executed_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
