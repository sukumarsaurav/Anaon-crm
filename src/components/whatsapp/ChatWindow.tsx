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

export default function ChatWindow({ conversation, messages, templates, advisors }: Props) {
  return (
    <div className="flex flex-col h-full">
      <ConversationHeader conversation={conversation} advisors={advisors} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">No messages yet</div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <ReplyBox
        conversationId={conversation.id}
        templates={templates}
        isOptedOut={conversation.opted_out}
      />
    </div>
  )
}
