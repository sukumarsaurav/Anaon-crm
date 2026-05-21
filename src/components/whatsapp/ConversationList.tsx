'use client'

import { useState, useTransition } from 'react'
import ConversationItem from './ConversationItem'
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

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      !search ||
      (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      c.contact_phone.includes(search)
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => startTransition(() => setSearch(e.target.value))}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-200 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-green-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No conversations</div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem key={conv.id} conversation={conv} isActive={conv.id === activeId} />
          ))
        )}
      </div>
    </div>
  )
}
