import { getConversations } from '@/lib/whatsapp/queries'
import InboxSidebar from '@/components/whatsapp/InboxSidebar'

export const dynamic = 'force-dynamic'

// The list lives in the layout so it is fetched once per visit to the inbox, not on every
// chat click; InboxSidebar keeps it live after that.
export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const conversations = await getConversations()
  return (
    <div className="flex h-full">
      <InboxSidebar initial={conversations} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
