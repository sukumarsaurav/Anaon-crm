export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getAutomationById, getAutomationLogs } from '@/lib/automation/queries'
import { createClient } from '@/lib/supabase/server'
import AutomationBuilder from '@/components/automation/AutomationBuilder'
import { DeleteAutomationButton } from '@/components/automation/DeleteAutomationButton'
import Link from 'next/link'
import { ChevronLeft, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

export default async function AutomationDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const [automation, advisors, logsAll] = await Promise.all([
    getAutomationById(id),
    supabase.from('profiles').select('id, full_name').in('role', ['sales_advisor', 'manager']).eq('is_active', true).order('full_name'),
    getAutomationLogs(50),
  ])

  if (!automation) notFound()

  const logs = logsAll.filter(l => (l as any).automation_id === id || l.automation?.name === automation.name)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/automation" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{automation.name}</h1>
            {automation.description && (
              <p className="text-sm text-slate-500 mt-0.5">{automation.description}</p>
            )}
          </div>
        </div>
        <DeleteAutomationButton id={id} />
      </div>

      <AutomationBuilder automation={automation} advisors={advisors.data ?? []} />

      {logs.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Execution History</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {logs.slice(0, 20).map(log => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0">
                    {log.status === 'success'
                      ? <CheckCircle2 size={14} className="text-green-500" />
                      : log.status === 'failed'
                      ? <XCircle size={14} className="text-red-500" />
                      : <Clock size={14} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">
                      {log.lead_name ?? log.lead_phone ?? '—'}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-red-500">{log.error_message}</p>
                    )}
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
