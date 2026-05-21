import { formatDateTime } from '@/lib/utils'
import type { TimelineEvent } from '@/types/clients'
import {
  Phone, MapPin, CreditCard, FileText, AlertCircle, MessageSquare, Activity,
} from 'lucide-react'

const TYPE_CONFIG = {
  activity: { icon: Activity,        color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  visit:    { icon: MapPin,          color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  payment:  { icon: CreditCard,      color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  document: { icon: FileText,        color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  complaint:{ icon: AlertCircle,     color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'   },
  whatsapp: { icon: MessageSquare,   color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200'},
}

interface Props {
  events: TimelineEvent[]
}

export default function CommunicationTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Activity size={24} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

      <div className="space-y-4">
        {events.map((event) => {
          const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.activity
          const Icon = cfg.icon

          return (
            <div key={event.id} className="relative flex gap-4 pl-2">
              {/* Icon dot */}
              <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border ${cfg.bg} ${cfg.border} shrink-0`}>
                <Icon size={13} className={cfg.color} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <p className="text-sm font-medium text-slate-800 leading-snug">{event.title}</p>
                {event.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{event.description}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">{formatDateTime(event.date)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
