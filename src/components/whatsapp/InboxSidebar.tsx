'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ConversationList from './ConversationList'
import type { WaConversation } from '@/types/whatsapp'

const LIST_LIMIT = 100
// Only used when the realtime socket is down; keeps the inbox from silently going stale.
const FALLBACK_POLL_MS = 15_000

const byRecent = (a: WaConversation, b: WaConversation) =>
  new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()

/**
 * The conversation list, mounted once in the inbox layout. It is fetched on the server a
 * single time and then kept current from Postgres changes, so opening a chat no longer
 * re-queries and re-renders the whole list (which also reset its scroll and filters).
 */
export default function InboxSidebar({ initial }: { initial: WaConversation[] }) {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const supabase = useMemo(() => createClient(), [])
  const [conversations, setConversations] = useState(initial)
  const [live, setLive] = useState(false)

  // A router.refresh() (new thread, fallback poll) hands down a fresh server copy.
  const [seenInitial, setSeenInitial] = useState(initial)
  if (seenInitial !== initial) {
    setSeenInitial(initial)
    setConversations(initial)
  }

  useEffect(() => {
    const channel = supabase
      .channel('wa-inbox-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) setConversations((prev) => prev.filter((c) => c.id !== id))
          return
        }
        const row = payload.new as WaConversation
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === row.id)
          // Realtime rows carry no joins (assignee, lead); keep the ones already loaded.
          // A thread we have never seen needs them, so ask the server for a fresh list.
          if (!existing) {
            router.refresh()
            return prev
          }
          return prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)).sort(byRecent).slice(0, LIST_LIMIT)
        })
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, router])

  useEffect(() => {
    if (live) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, FALLBACK_POLL_MS)
    return () => clearInterval(timer)
  }, [live, router])

  return (
    // Phones show one pane at a time: the list on /whatsapp/inbox, the chat on /whatsapp/inbox/[id].
    <div className={`w-full md:w-80 shrink-0 border-r border-slate-200 bg-white flex-col ${params?.id ? 'hidden md:flex' : 'flex'}`}>
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h1 className="font-semibold text-slate-900">WhatsApp Inbox</h1>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span
            title={live ? 'Live' : 'Reconnecting — refreshing every 15s'}
            className={`inline-block size-1.5 rounded-full ${live ? 'bg-green-500' : 'bg-amber-400'}`}
          />
          {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationList conversations={conversations} activeId={params?.id} />
      </div>
    </div>
  )
}
