'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CalendarClock, MapPin, UserPlus, Bot, Mail,
  MessageCircle, ArrowRightLeft, Info, CheckCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from './ProfileProvider'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean | null
  created_at: string | null
  action_url: string | null
}

const typeConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  followup_reminder:   { icon: CalendarClock,  color: 'text-amber-600',   bg: 'bg-amber-100' },
  follow_up:           { icon: CalendarClock,  color: 'text-amber-600',   bg: 'bg-amber-100' },
  site_visit_reminder: { icon: MapPin,         color: 'text-primary',     bg: 'bg-primary-100' },
  assignment:          { icon: UserPlus,       color: 'text-emerald-600', bg: 'bg-emerald-100' },
  lead_assigned:       { icon: UserPlus,       color: 'text-emerald-600', bg: 'bg-emerald-100' },
  lead:                { icon: UserPlus,       color: 'text-emerald-600', bg: 'bg-emerald-100' },
  automation:          { icon: Bot,            color: 'text-purple-600',  bg: 'bg-purple-100' },
  email_intent:        { icon: Mail,           color: 'text-primary',     bg: 'bg-primary-100' },
  whatsapp_intent:     { icon: MessageCircle,  color: 'text-emerald-600', bg: 'bg-emerald-100' },
  stage_change:        { icon: ArrowRightLeft, color: 'text-orange-600',  bg: 'bg-orange-100' },
  system:              { icon: Info,           color: 'text-slate-600',   bg: 'bg-slate-100' },
}

const fallbackConfig = { icon: Info, color: 'text-slate-600', bg: 'bg-slate-100' }

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const { userId } = useProfile()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = items.filter((n) => !n.is_read).length

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at, action_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data ?? []) as NotificationRow[])
    setLoading(false)
  }, [supabase, userId])

  // Initial unread badge + live updates.
  useEffect(() => {
    load()
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, load])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  }

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setOpen(false)
    if (n.action_url) router.push(n.action_url)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative size-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus-ring"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors focus-ring rounded px-1"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-500">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const cfg = typeConfig[n.type] ?? fallbackConfig
                const Icon = cfg.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors focus-ring',
                      !n.is_read && 'bg-primary-50/60',
                    )}
                  >
                    <span className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                      <Icon size={16} className={cfg.color} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 truncate">{n.title}</span>
                      {n.body && <span className="block text-xs text-slate-500 line-clamp-2 mt-0.5">{n.body}</span>}
                      <span className="block text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="size-2 bg-primary rounded-full shrink-0 mt-1.5" aria-hidden="true" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
