import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import RelativeTime from '@/components/ui/RelativeTime'
import type { WaBroadcast } from '@/types/whatsapp'

interface Props {
  broadcast: WaBroadcast
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  scheduled: { label: 'Scheduled', color: 'text-blue-700', bg: 'bg-blue-50' },
  sending: { label: 'Sending...', color: 'text-amber-700', bg: 'bg-amber-50' },
  sent: { label: 'Sent', color: 'text-green-700', bg: 'bg-green-50' },
  paused: { label: 'Paused', color: 'text-orange-700', bg: 'bg-orange-50' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50' },
}

export default function BroadcastCard({ broadcast }: Props) {
  const statusCfg = STATUS_CONFIG[broadcast.status] ?? STATUS_CONFIG.draft
  const deliveryRate =
    broadcast.total_sent > 0
      ? Math.round((broadcast.total_delivered / broadcast.total_sent) * 100)
      : 0
  const readRate =
    broadcast.total_sent > 0
      ? Math.round((broadcast.total_read / broadcast.total_sent) * 100)
      : 0

  return (
    <Link
      href={`/whatsapp/broadcasts/${broadcast.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{broadcast.name}</h3>
          {broadcast.template && (
            <p className="text-xs text-gray-500 mt-0.5">Template: {broadcast.template.display_name}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusCfg.color} ${statusCfg.bg}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 text-center mb-3">
        <div>
          <div className="text-lg font-bold text-gray-900">{broadcast.audience_count}</div>
          <div className="text-xs text-gray-400">Audience</div>
        </div>
        <div>
          <div className="text-lg font-bold text-blue-600">{broadcast.total_sent}</div>
          <div className="text-xs text-gray-400">Sent</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-600">{deliveryRate}%</div>
          <div className="text-xs text-gray-400">Delivered</div>
        </div>
        <div>
          <div className="text-lg font-bold text-purple-600">{readRate}%</div>
          <div className="text-xs text-gray-400">Read</div>
        </div>
      </div>

      {/* Progress bar for sent */}
      {broadcast.status === 'sending' && broadcast.audience_count > 0 && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.round((broadcast.total_sent / broadcast.audience_count) * 100)}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {broadcast.scheduled_at
            ? `Scheduled: ${formatDateTime(broadcast.scheduled_at)}`
            : broadcast.sent_at
            ? <><span>Sent: </span><RelativeTime date={broadcast.sent_at} /></>
            : <><span>Created: </span><RelativeTime date={broadcast.created_at} /></>}
        </span>
        {broadcast.total_failed > 0 && (
          <span className="text-red-500">{broadcast.total_failed} failed</span>
        )}
      </div>
    </Link>
  )
}
