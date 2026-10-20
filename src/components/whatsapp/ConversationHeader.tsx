'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, User, Check } from 'lucide-react'
import { assignConversation, resolveConversation, takeBotControl } from '@/lib/whatsapp/actions'
import { CONVERSATION_STATUS_CONFIG } from '@/types/whatsapp'
import type { WaConversation } from '@/types/whatsapp'
import type { Profile } from '@/types/leads'
import { getInitials } from '@/lib/utils'

interface Props {
  conversation: WaConversation
  advisors: Profile[]
}

export default function ConversationHeader({ conversation, advisors }: Props) {
  const [showAssign, setShowAssign] = useState(false)
  const [isPending, startTransition] = useTransition()
  const statusCfg = CONVERSATION_STATUS_CONFIG[conversation.status]
  const name = conversation.contact_name ?? conversation.contact_phone

  function handleAssign(advisorId: string) {
    startTransition(async () => {
      await assignConversation(conversation.id, advisorId)
      setShowAssign(false)
    })
  }

  function handleResolve() {
    startTransition(async () => { await resolveConversation(conversation.id) })
  }

  function handleToggleBot() {
    startTransition(async () => { await takeBotControl(conversation.id, !conversation.is_bot_active) })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-white border-b border-slate-200">
      {/* Left: contact info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* On phones the list is hidden while a chat is open, so this is the way back to it. */}
        <Link
          href="/whatsapp/inbox"
          aria-label="Back to conversations"
          className="md:hidden -ml-1 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus-ring shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm shrink-0">
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-slate-900 text-sm truncate">{name}</h2>
            <span className={`shrink-0 whitespace-nowrap text-xs px-1.5 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.bg}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-500">{conversation.contact_phone}</p>
        </div>
        {conversation.lead && (
          <Link
            href={`/leads/${conversation.lead.id}`}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap shrink-0"
          >
            View Lead →
          </Link>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 relative ml-auto">
        {/* Bot toggle */}
        <button
          onClick={handleToggleBot}
          disabled={isPending}
          className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
            conversation.is_bot_active
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Bot size={13} className="inline-block" /> {conversation.is_bot_active ? 'Bot ON' : 'Bot OFF'}
        </button>

        {/* Assign */}
        <div className="relative">
          <button
            onClick={() => setShowAssign((v) => !v)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
          >
            {conversation.assigned_profile ? <><User size={13} className="inline-block mr-1" />{conversation.assigned_profile.full_name}</> : 'Assign'}
          </button>
          {showAssign && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
              {advisors.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAssign(a.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700"
                >
                  {a.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resolve */}
        {conversation.status !== 'resolved' && conversation.status !== 'closed' && (
          <button
            onClick={handleResolve}
            disabled={isPending}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 font-medium"
          >
            <Check size={13} className="inline-block mr-1" />Resolve
          </button>
        )}
      </div>
    </div>
  )
}
