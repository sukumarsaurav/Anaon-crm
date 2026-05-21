import { MessageSquare } from 'lucide-react'
import { getConversations } from '@/lib/whatsapp/queries'
import ConversationList from '@/components/whatsapp/ConversationList'
import EmptyState from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const conversations = await getConversations()

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h1 className="font-semibold text-slate-900">WhatsApp Inbox</h1>
          <span className="text-xs text-slate-500">{conversations.length} conversations</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList conversations={conversations} />
        </div>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <EmptyState
          icon={<MessageSquare size={40} />}
          title="Select a conversation"
          description="Choose a conversation from the list to start chatting"
        />
      </div>
    </div>
  )
}
