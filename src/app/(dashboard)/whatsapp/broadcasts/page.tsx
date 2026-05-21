import { Megaphone, Plus } from 'lucide-react'
import { getBroadcasts } from '@/lib/whatsapp/queries'
import BroadcastCard from '@/components/whatsapp/BroadcastCard'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

export default async function BroadcastsPage() {
  const broadcasts = await getBroadcasts()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Broadcast Campaigns"
        subtitle="Send bulk WhatsApp messages to your leads"
        actions={
          <Button href="/whatsapp/broadcasts/new">
            <Plus size={16} /> New Broadcast
          </Button>
        }
      />

      {broadcasts.length === 0 ? (
        <EmptyState
          bordered
          icon={<Megaphone size={40} />}
          title="No broadcasts yet"
          description="Create your first campaign to reach leads at scale"
          action={
            <Button href="/whatsapp/broadcasts/new">
              <Plus size={16} /> Create Broadcast
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {broadcasts.map((broadcast) => (
            <BroadcastCard key={broadcast.id} broadcast={broadcast} />
          ))}
        </div>
      )}
    </div>
  )
}
