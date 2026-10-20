'use client'

import { useEffect, useState, useTransition } from 'react'
import ConversationItem from './ConversationItem'
import { getConversations } from '@/lib/whatsapp/queries'
import type { WaConversation, WaConversationStatus } from '@/types/whatsapp'

interface Props {
  conversations: WaConversation[]
  activeId?: string
}

const STATUS_TABS: Array<{ label: string; value: WaConversationStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
]

export default function ConversationList({ conversations, activeId }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<WaConversationStatus | 'all'>('all')
  const [, startTransition] = useTransition()

  // Only the latest 100 chats are loaded, so filtering them could never find an older one.
  // Two or more characters also search every conversation on the server.
  const term = search.trim()
  const [remote, setRemote] = useState<{ term: string; rows: WaConversation[] } | null>(null)
  useEffect(() => {
    if (term.length < 2) return
    let cancelled = false
    const t = setTimeout(async () => {
      const rows = await getConversations({ search: term })
      if (!cancelled) setRemote({ term, rows })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [term])
  const serverRows = term.length >= 2 && remote?.term === term ? remote.rows : null
  const searchingServer = term.length >= 2 && !serverRows

  const lower = term.toLowerCase()
  const digits = term.replace(/\D/g, '')
  const filtered = (serverRows ?? conversations).filter((c) => {
    const matchesSearch =
      serverRows !== null ||
      !term ||
      (c.contact_name ?? '').toLowerCase().includes(lower) ||
      (digits.length > 0 && c.contact_phone.replace(/\D/g, '').includes(digits))
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-slate-200">
        <input aria-label="Search conversations..."
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => startTransition(() => setSearch(e.target.value))}
          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-200 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-green-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {searchingServer && (
          <p className="px-4 py-2 text-xs text-slate-400" aria-live="polite">Searching all conversations…</p>
        )}
        {filtered.length === 0 ? (
          !searchingServer && (
            <div className="p-8 text-center text-slate-400 text-sm">
              {term ? `No conversations match “${term}”` : 'No conversations'}
            </div>
          )
        ) : (
          filtered.map((conv) => (
            <ConversationItem key={conv.id} conversation={conv} isActive={conv.id === activeId} />
          ))
        )}
      </div>
    </div>
  )
}
