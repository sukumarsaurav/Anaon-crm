import { FileText, Plus } from 'lucide-react'
import { getTemplates } from '@/lib/whatsapp/queries'
import TemplateCard from '@/components/whatsapp/TemplateCard'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import SyncTemplatesButton from '@/components/whatsapp/TemplateActions'
import { agencyXConfigured } from '@/lib/whatsapp/agencyx-api'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const templates = await getTemplates(false)
  const connected = agencyXConfigured()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Message Templates"
        subtitle="Create templates here and submit them to WhatsApp for approval. Approved ones power broadcasts, automations and first messages."
        actions={
          <div className="flex items-center gap-2">
            <SyncTemplatesButton enabled={connected} />
            <Button href="/whatsapp/templates/new">
              <Plus size={16} /> New Template
            </Button>
          </div>
        }
      />

      {!connected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AgencyX is not connected (AGENCYX_API_KEY), so templates can be drafted but not submitted for approval or sent.
          See Settings → Integrations.
        </div>
      )}

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
            <TemplateCard key={template.id} template={template} canSubmit={connected} />
          ))}
        </div>
      )}
    </div>
  )
}
