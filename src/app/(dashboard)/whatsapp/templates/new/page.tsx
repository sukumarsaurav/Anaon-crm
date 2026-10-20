import TemplateForm from '@/components/whatsapp/TemplateForm'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { agencyXConfigured } from '@/lib/whatsapp/agencyx-api'

export const metadata = { title: 'New Template' }

export default function NewTemplatePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="New Template"
        subtitle="WhatsApp only delivers approved templates to customers who haven't messaged you in 24 hours."
        backHref="/whatsapp/templates"
      />
      <Card padding="lg">
        <TemplateForm canSubmit={agencyXConfigured()} />
      </Card>
    </div>
  )
}
