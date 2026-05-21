import { getTemplates } from '@/lib/whatsapp/queries'
import BroadcastForm from '@/components/whatsapp/BroadcastForm'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default async function NewBroadcastPage() {
  const templates = await getTemplates(true)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="New Broadcast"
        subtitle="Send a template message to a filtered segment of your leads"
        backHref="/whatsapp/broadcasts"
      />
      <Card padding="lg">
        <BroadcastForm templates={templates} />
      </Card>
    </div>
  )
}
