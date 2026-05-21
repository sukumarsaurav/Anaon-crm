'use client'

import Link from 'next/link'
import { Bot } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import RelativeTime from '@/components/ui/RelativeTime'
import { CONVERSATION_STATUS_CONFIG } from '@/types/whatsapp'
import type { WaConversation } from '@/types/whatsapp'

interface Props {
  conversation: WaConversation
  isActive?: boolean
}

export default function ConversationItem({ conversation, isActive }: Props) {
  const statusCfg = CONVERSATION_STATUS_CONFIG[conversation.status]
  const name = conversation.contact_name ?? conversation.contact_phone
  const initials = getInitials(name)

  return (
    <Link
      href={`/whatsapp/inbox/${conversation.id}`}
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isActive ? 'bg-green-50 border-l-2 border-l-green-500' : ''
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900 text-sm truncate">{name}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {conversation.last_message_at ? <RelativeTime date={conversation.last_message_at} /> : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-gray-500 truncate">{conversation.last_message_preview ?? 'No messages yet'}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {conversation.unread_count > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-green-500 text-white text-xs rounded-full font-medium">
                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.bg}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>
        {conversation.is_bot_active && (
          <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1"><Bot size={10} /> Bot active</p>
        )}
      </div>
    </Link>
  )
}
