import { MessageSquare } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { getConversationStats } from '@/lib/whatsapp/queries'

export const metadata = { title: 'WhatsApp Inbox' }

export default async function InboxPage() {
  const stats = await getConversationStats()
  const tiles = [
    { label: 'Open', value: stats.open },
    { label: 'Unread', value: stats.unread },
    { label: 'New', value: stats.new },
    { label: 'All conversations', value: stats.total },
  ]
  return (
    <div className="h-full hidden md:flex flex-col items-center justify-center gap-6 bg-slate-50">
      <div className="grid grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center min-w-24">
            <p className="text-xl font-bold text-slate-900">{t.value}</p>
            <p className="text-xs text-slate-500">{t.label}</p>
          </div>
        ))}
      </div>
      <EmptyState
        icon={<MessageSquare size={40} />}
        title="Select a conversation"
        description="Choose a conversation from the list to start chatting"
      />
    </div>
  )
}
