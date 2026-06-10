export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { notFound } from 'next/navigation'
import { getAuditLogs } from '@/lib/security/audit'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'

const ACTION_COLORS: Record<string, string> = {
  login:                  'bg-emerald-100 text-emerald-700',
  logout:                 'bg-slate-100 text-slate-600',
  login_failed:           'bg-red-100 text-red-700',
  login_locked:           'bg-red-200 text-red-800',
  lead_created:           'bg-blue-100 text-blue-700',
  lead_updated:           'bg-blue-50 text-blue-600',
  lead_deleted:           'bg-red-100 text-red-700',
  booking_created:        'bg-indigo-100 text-indigo-700',
  payment_created:        'bg-emerald-100 text-emerald-700',
  document_viewed:        'bg-amber-100 text-amber-700',
  user_created:           'bg-purple-100 text-purple-700',
  role_changed:           'bg-amber-100 text-amber-700',
  '2fa_enabled':          'bg-emerald-100 text-emerald-700',
  '2fa_disabled':         'bg-amber-100 text-amber-700',
  '2fa_failed':           'bg-red-100 text-red-700',
  session_revoked:        'bg-slate-100 text-slate-700',
  sensitive_field_viewed: 'bg-amber-100 text-amber-800',
}

interface SearchParams {
  page?: string
  user_id?: string
  action?: string
  table_name?: string
  start_date?: string
  end_date?: string
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) notFound()

  const profile = (await getProfile())?.profile
  if (!['admin', 'manager'].includes(profile?.role ?? '')) notFound()

  const page = Number(sp.page ?? 1)
  const pageSize = 50

  const { data: logs, count } = await getAuditLogs({
    userId: sp.user_id,
    action: sp.action,
    tableName: sp.table_name,
    startDate: sp.start_date,
    endDate: sp.end_date,
    page,
    pageSize,
  })

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'manager', 'sales_advisor', 'telecaller'])
    .eq('is_active', true)
    .order('full_name')

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const ACTIONS = [
    'login', 'logout', 'login_failed', 'login_locked',
    'lead_created', 'lead_updated', 'lead_deleted', 'lead_stage_changed',
    'booking_created', 'payment_created', 'document_viewed',
    'user_created', 'role_changed', '2fa_enabled', '2fa_disabled',
    '2fa_failed', 'session_revoked', 'export_leads', 'sensitive_field_viewed',
  ]

  const exportUrl = `/api/audit-logs/export?${new URLSearchParams({
    ...(sp.user_id ? { user_id: sp.user_id } : {}),
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.start_date ? { start_date: sp.start_date } : {}),
    ...(sp.end_date ? { end_date: sp.end_date } : {}),
  }).toString()}`

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={`Immutable record of all system actions · ${count?.toLocaleString() ?? 0} entries`}
        actions={
          <Button href={exportUrl} variant="secondary" size="sm" external>
            <Download size={14} /> Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <form method="GET" className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select name="user_id" defaultValue={sp.user_id ?? ''}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400 bg-white text-slate-900">
            <option value="">All Users</option>
            {users?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <select name="action" defaultValue={sp.action ?? ''}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400 bg-white text-slate-900">
            <option value="">All Actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <input name="start_date" type="date" defaultValue={sp.start_date ?? ''}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400 text-slate-900" />
          <input name="end_date" type="date" defaultValue={sp.end_date ?? ''}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400 text-slate-900" />
          <div className="flex gap-2">
            <button type="submit"
              className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Filter
            </button>
            <Link href="/audit-logs"
              className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              Clear
            </Link>
          </div>
        </div>
      </form>

      {/* Log table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Table</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(logs ?? []).map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-800">
                      {log.profiles?.full_name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'
                    }`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{log.table_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{String(log.ip_address ?? '—')}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata).slice(0, 60) : '—'}
                  </td>
                </tr>
              ))}
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No audit log entries match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} · {count?.toLocaleString()} entries
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  <ChevronLeft size={14} /> Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Next <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
