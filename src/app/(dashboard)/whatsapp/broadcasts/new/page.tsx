import { getTemplates } from '@/lib/whatsapp/queries'
import { createClient } from '@/lib/supabase/server'
import BroadcastForm from '@/components/whatsapp/BroadcastForm'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'New Broadcast' }

export default async function NewBroadcastPage() {
  const supabase = await createClient()
  const [templates, { data: projects }] = await Promise.all([
    getTemplates(true),
    supabase.from('projects').select('id, name').order('name'),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="New Broadcast"
        subtitle="Send a template message to a filtered segment of your leads"
        backHref="/whatsapp/broadcasts"
      />
      <Card padding="lg">
        <BroadcastForm templates={templates} projects={projects ?? []} />
      </Card>
    </div>
  )
}
