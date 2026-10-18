import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBroadcastById } from '@/lib/whatsapp/queries'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import BroadcastControls from '@/components/whatsapp/BroadcastControls'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
  read: 'bg-purple-50 text-purple-700',
  failed: 'bg-red-50 text-red-700',
}

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const broadcast = await getBroadcastById(id)
  if (!broadcast) notFound()

  const supabase = await createClient()
  const { data: recipients } = await supabase
    .from('whatsapp_broadcast_recipients')
    .select('id, name, phone, status, failed_reason, replied, sent_at')
    .eq('broadcast_id', id)
    .order('created_at')
    .limit(500)
  const rows = recipients ?? []
  const queued = rows.filter((r) => r.status === 'queued').length

  const stats = [
    { label: 'Audience', value: broadcast.audience_count },
    { label: 'Queued', value: queued },
    { label: 'Sent', value: broadcast.total_sent },
    { label: 'Delivered', value: broadcast.total_delivered },
    { label: 'Read', value: broadcast.total_read },
    { label: 'Replied', value: broadcast.total_replied },
    { label: 'Failed', value: broadcast.total_failed },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title={broadcast.name}
        subtitle={`Template: ${broadcast.template?.display_name ?? '—'} · Status: ${broadcast.status}${
          broadcast.scheduled_at ? ` · Scheduled ${formatDateTime(broadcast.scheduled_at)}` : ''
        }`}
        backHref="/whatsapp/broadcasts"
        actions={<BroadcastControls id={broadcast.id} status={broadcast.status} queued={queued} />}
      />

      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
        {stats.map((s) => (
          <Card key={s.label} padding="sm">
            <div className="text-xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {broadcast.template?.body && (
        <Card padding="md">
          <p className="text-xs text-slate-500 mb-1">Message</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{broadcast.template.body}</p>
        </Card>
      )}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Recipient</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Not started yet — recipients are resolved when it is sent.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{r.name ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">+{r.phone}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? STATUS_STYLE.queued}`}>{r.status}</span>
                    {r.replied && <span className="ml-1 text-xs text-green-700">replied</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.failed_reason ?? (r.sent_at ? formatDateTime(r.sent_at) : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
