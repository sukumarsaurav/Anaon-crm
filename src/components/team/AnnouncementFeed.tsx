'use client'

import { useTransition } from 'react'
import { Pin, Trash2, Megaphone, Trophy, AlertTriangle, Rocket } from 'lucide-react'
import RelativeTime from '@/components/ui/RelativeTime'
import { pinAnnouncement, deleteAnnouncement } from '@/lib/team/actions'
import { ANNOUNCEMENT_TYPE_CONFIG } from '@/types/team'
import type { Announcement } from '@/types/team'

const TYPE_ICONS = {
  announcement:   Megaphone,
  shoutout:       Trophy,
  alert:          AlertTriangle,
  project_launch: Rocket,
} as const

interface Props {
  announcements: Announcement[]
  canManage?: boolean
}

export default function AnnouncementFeed({ announcements, canManage }: Props) {
  const [, startTransition] = useTransition()

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No announcements yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => {
        const cfg = ANNOUNCEMENT_TYPE_CONFIG[a.type]
        const Icon = TYPE_ICONS[a.type] ?? Megaphone
        return (
          <div
            key={a.id}
            className={`bg-white border rounded-xl p-4 ${a.is_pinned ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <Icon size={15} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {a.is_pinned && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        <Pin size={10} /> Pinned
                      </span>
                    )}
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <h4 className="font-semibold text-slate-900">{a.title}</h4>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    {a.author && <span>{a.author.full_name}</span>}
                    <span>·</span>
                    <RelativeTime date={a.created_at} />
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startTransition(async () => { await pinAnnouncement(a.id, !a.is_pinned) })}
                    title={a.is_pinned ? 'Unpin' : 'Pin'}
                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    onClick={() => startTransition(async () => { await deleteAnnouncement(a.id) })}
                    title="Delete"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
