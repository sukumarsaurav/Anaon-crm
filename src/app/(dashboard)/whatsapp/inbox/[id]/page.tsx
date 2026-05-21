import { notFound } from 'next/navigation'
import { getConversations, getConversationById, getMessages, getTemplates } from '@/lib/whatsapp/queries'
import { getActiveAdvisors } from '@/lib/leads/queries'
import { markConversationRead } from '@/lib/whatsapp/actions'
import ConversationList from '@/components/whatsapp/ConversationList'
import ChatWindow from '@/components/whatsapp/ChatWindow'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params

  const [conversations, conversation, messages, templates, advisors] = await Promise.all([
    getConversations(),
    getConversationById(id),
    getMessages(id),
    getTemplates(true),
    getActiveAdvisors(),
  ])

  if (!conversation) notFound()

  // Mark as read (fire-and-forget)
  markConversationRead(id).catch(() => {})

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h1 className="font-semibold text-slate-900">WhatsApp Inbox</h1>
          <span className="text-xs text-slate-500">{conversations.length} conversations</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList conversations={conversations} activeId={id} />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          conversation={conversation}
          messages={messages}
          templates={templates}
          advisors={advisors}
        />
      </div>
    </div>
  )
}
