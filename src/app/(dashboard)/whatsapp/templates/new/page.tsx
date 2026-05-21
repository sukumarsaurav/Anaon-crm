import TemplateForm from '@/components/whatsapp/TemplateForm'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default function NewTemplatePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="New Template"
        subtitle="Templates must be approved by Meta before use. Approval typically takes 24–48 hours."
        backHref="/whatsapp/templates"
      />
      <Card padding="lg">
        <TemplateForm />
      </Card>
    </div>
  )
}
