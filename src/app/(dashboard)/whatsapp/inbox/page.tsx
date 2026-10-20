import { MessageSquare } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

export default function InboxPage() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <EmptyState
        icon={<MessageSquare size={40} />}
        title="Select a conversation"
        description="Choose a conversation from the list to start chatting"
      />
    </div>
  )
}
