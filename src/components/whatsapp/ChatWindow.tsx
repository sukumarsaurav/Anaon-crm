'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markConversationRead } from '@/lib/whatsapp/actions'
import MessageBubble from './MessageBubble'
import ReplyBox from './ReplyBox'
import ConversationHeader from './ConversationHeader'
import type { WaConversation, WaMessage, WaTemplate } from '@/types/whatsapp'
import type { Profile } from '@/types/leads'

interface Props {
  conversation: WaConversation
  messages: WaMessage[]
  templates: WaTemplate[]
  advisors: Profile[]
}

interface PendingMessage {
  tempId: string
  body: string
  at: number
}

const byTime = (a: WaMessage, b: WaMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

export default function ChatWindow({ conversation, messages: initial, templates, advisors }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState(initial)
  const [pending, setPending] = useState<PendingMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const conversationId = conversation.id

  // A server render (after a send, or the inbox's fallback refresh) replaces local state.
  const [seenInitial, setSeenInitial] = useState(initial)
  if (seenInitial !== initial) {
    setSeenInitial(initial)
    setMessages(initial)
  }

  const markRead = useCallback(() => {
    if (document.visibilityState === 'visible') void markConversationRead(conversationId)
  }, [conversationId])

  // Opening a chat reads it. Done here, not while rendering the page, so it neither delays
  // the page nor re-renders the list; the sidebar sees the change over realtime.
  // A chat left open in a background tab is read once the agent comes back to it.
  useEffect(() => {
    markRead()
    document.addEventListener('visibilitychange', markRead)
    return () => document.removeEventListener('visibilitychange', markRead)
  }, [markRead])

  useEffect(() => {
    const channel = supabase
      .channel(`wa-thread-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new as WaMessage
          // Files are stored privately and signed on the server; a raw row can't show them.
          if (row.media_url && payload.eventType === 'INSERT') {
            router.refresh()
            if (row.direction === 'inbound') markRead()
            return
          }
          setMessages((prev) => {
            const i = prev.findIndex((m) => m.id === row.id)
            if (i === -1) return [...prev, row].sort(byTime)
            // Receipts (sent → delivered → read) update in place, keeping the signed media URL.
            const next = prev.slice()
            next[i] = { ...prev[i], ...row, media_url: prev[i].media_url, sender: prev[i].sender }
            return next
          })
          if (payload.eventType === 'INSERT' && row.direction === 'inbound') markRead()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, conversationId, router, markRead])

  // The optimistic bubble is hidden as soon as the saved copy of that message is in the list.
  const shownPending = pending.filter(
    (p) => !messages.some((m) => m.direction === 'outbound' && m.body === p.body && new Date(m.created_at).getTime() >= p.at - 10_000),
  )

  // Follow new messages only when the agent is already at the bottom. Jumping down on every
  // message made it impossible to read back through a chat while the customer was typing.
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [unseen, setUnseen] = useState(0)
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottomRef.current) setUnseen(0)
  }, [])
  const jumpToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    setUnseen(0)
  }, [])

  const count = messages.length + shownPending.length
  const lastCount = useRef({ conversationId, count })
  useEffect(() => {
    const prev = lastCount.current
    lastCount.current = { conversationId, count }
    const switched = prev.conversationId !== conversationId
    const own = shownPending.length > 0 // the agent just sent something: always show it
    if (switched || own || atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
      atBottomRef.current = true
    } else if (count > prev.count) {
      setUnseen((n) => n + (count - prev.count))
    }
  }, [count, conversationId, shownPending.length])

  const addPending = useCallback((body: string) => {
    const tempId = `tmp-${crypto.randomUUID()}`
    setPending((prev) => [...prev, { tempId, body, at: Date.now() }])
    return tempId
  }, [])
  const dropPending = useCallback((tempId: string) => {
    setPending((prev) => prev.filter((p) => p.tempId !== tempId))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader conversation={conversation} advisors={advisors} />

      {/* Messages */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      {unseen > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-green-700 focus-ring"
        >
          {unseen} new message{unseen === 1 ? '' : 's'} ↓
        </button>
      )}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 space-y-1">
        {count === 0 && <div className="text-center text-slate-400 text-sm py-12">No messages yet</div>}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {shownPending.map((p) => (
          <MessageBubble
            key={p.tempId}
            message={{
              id: p.tempId,
              conversation_id: conversationId,
              direction: 'outbound',
              type: 'text',
              body: p.body,
              delivery_status: 'queued',
              is_bot_message: false,
              created_at: new Date(p.at).toISOString(),
            } as WaMessage}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      </div>

      <ReplyBox
        conversationId={conversationId}
        templates={templates}
        isOptedOut={conversation.opted_out}
        onOptimistic={addPending}
        onFailed={dropPending}
      />
    </div>
  )
}
