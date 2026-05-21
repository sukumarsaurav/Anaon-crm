import { FileText, Plus } from 'lucide-react'
import { getTemplates } from '@/lib/whatsapp/queries'
import TemplateCard from '@/components/whatsapp/TemplateCard'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const templates = await getTemplates(false)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Message Templates"
        subtitle="Approved templates are used for broadcast campaigns and outbound messages"
        actions={
          <Button href="/whatsapp/templates/new">
            <Plus size={16} /> New Template
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          bordered
          icon={<FileText size={40} />}
          title="No templates yet"
          description="Create a template and submit it for Meta approval"
          action={
            <Button href="/whatsapp/templates/new">
              <Plus size={16} /> Create First Template
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  )
}
