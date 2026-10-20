export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import RelativeTime from '@/components/ui/RelativeTime'
import ComplaintQueueActions from '@/components/clients/ComplaintQueueActions'
import {
  COMPLAINT_STATUS_CONFIG, COMPLAINT_PRIORITY_CONFIG, COMPLAINT_CATEGORY_LABELS,
} from '@/types/clients'
import type { ComplaintStatus, ComplaintPriority, ComplaintCategory } from '@/types/clients'

export const metadata = { title: 'Complaints' }

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; assigned?: string }>
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'active', label: 'Open & in progress' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

/**
 * Every client complaint in one place (portal and staff-raised). They were only visible on each
 * client's own page, so nobody could see what was waiting or who owned it.
 */
export default async function ComplaintsQueuePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status = sp.status ?? 'active'
  const session = await getProfile()
  const canAssign = ['admin', 'manager'].includes(session?.profile?.role ?? '')
  const supabase = await createClient()

  let q = supabase
    .from('complaints')
    .select('id, ticket_number, client_id, category, priority, description, status, assigned_to, created_at, resolved_at, client:clients!complaints_client_id_fkey(id, full_name, phone), assignee:profiles!complaints_assigned_to_fkey(id, full_name)')
    .order('created_at', { ascending: true })
    .limit(500)
  if (status === 'active') q = q.in('status', ['open', 'in_progress', 'escalated'])
  else if (status !== 'all') q = q.eq('status', status as ComplaintStatus)
  if (sp.priority) q = q.eq('priority', sp.priority)
  if (sp.assigned === 'me' && session?.user) q = q.eq('assigned_to', session.user.id)
  if (sp.assigned === 'none') q = q.is('assigned_to', null)

  const [{ data: rows, error }, { data: staff }] = await Promise.all([
    q,
    canAssign
      ? supabase.from('profiles').select('id, full_name').eq('is_active', true).in('role', ['admin', 'manager', 'sales_advisor', 'telecaller']).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])
  if (error) console.error('[complaints] queue query failed:', error.message)

  // Most urgent first, then oldest first.
  const complaints = [...(rows ?? [])].sort((a, b) =>
    (PRIORITY_ORDER[a.priority ?? 'normal'] ?? 2) - (PRIORITY_ORDER[b.priority ?? 'normal'] ?? 2))

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { status, priority: sp.priority, assigned: sp.assigned, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v)
    return `/clients/complaints?${next.toString()}`
  }
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${active ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`

  return (
    <div className="p-6 space-y-5">
      <PageHeader backHref="/clients" title="Complaints" subtitle={`${complaints.length} shown`} />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => <Link key={t.value} href={href({ status: t.value })} className={chip(status === t.value)}>{t.label}</Link>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ assigned: undefined })} className={chip(!sp.assigned)}>Anyone</Link>
        <Link href={href({ assigned: 'me' })} className={chip(sp.assigned === 'me')}>Assigned to me</Link>
        <Link href={href({ assigned: 'none' })} className={chip(sp.assigned === 'none')}>Unassigned</Link>
        <span className="w-px bg-slate-200 mx-1" aria-hidden="true" />
        <Link href={href({ priority: undefined })} className={chip(!sp.priority)}>Any priority</Link>
        {(['urgent', 'high'] as ComplaintPriority[]).map((p) => (
          <Link key={p} href={href({ priority: p })} className={chip(sp.priority === p)}>{COMPLAINT_PRIORITY_CONFIG[p].label}</Link>
        ))}
      </div>

      {complaints.length === 0 ? (
        <EmptyState title="No complaints here" description="Nothing matches these filters." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {complaints.map((c) => {
            const client = (Array.isArray(c.client) ? c.client[0] : c.client) as { id: string; full_name: string; phone: string } | null
            const assignee = (Array.isArray(c.assignee) ? c.assignee[0] : c.assignee) as { full_name: string } | null
            const st = COMPLAINT_STATUS_CONFIG[c.status as ComplaintStatus]
            const pr = COMPLAINT_PRIORITY_CONFIG[(c.priority ?? 'normal') as ComplaintPriority]
            return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{c.ticket_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st?.bg} ${st?.color}`}>{st?.label}</span>
                    <span className={`text-xs font-medium ${pr?.color}`}>{pr?.label}</span>
                    <span className="text-xs text-slate-500">{COMPLAINT_CATEGORY_LABELS[c.category as ComplaintCategory] ?? c.category}</span>
                  </div>
                  <p className="text-sm text-slate-900 mt-1 line-clamp-2">{c.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {client ? <Link href={`/clients/${client.id}?tab=complaints`} className="text-primary-600 hover:underline">{client.full_name}</Link> : '—'}
                    {' · '}Raised <RelativeTime date={c.created_at} />
                    {' · '}{assignee ? `Owner: ${assignee.full_name}` : 'Unassigned'}
                  </p>
                </div>
                <ComplaintQueueActions complaintId={c.id} status={c.status as ComplaintStatus} assignedTo={c.assigned_to}
                  staff={staff ?? []} canAssign={canAssign} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
