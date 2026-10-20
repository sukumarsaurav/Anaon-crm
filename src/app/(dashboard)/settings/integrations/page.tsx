export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import PageHeader from '@/components/ui/PageHeader'
import IntegrationsPanel from '@/components/settings/IntegrationsPanel'

export const metadata = { title: 'Integrations' }

export default async function IntegrationsSettingsPage() {
  const role = (await getProfile())?.profile?.role
  if (role !== 'admin') notFound()

  const secret = process.env.LEAD_WEBHOOK_SECRET ?? 'anon_india_lead_secret'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref="/settings"
        title="Lead Capture Integrations"
        subtitle="Connect lead sources to auto-import inquiries into the pipeline"
      />
      <IntegrationsPanel
        secret={secret}
        appUrl={appUrl}
        agencyxConfigured={Boolean(process.env.AGENCYX_WEBHOOK_SECRET)}
        agencyxSendConfigured={Boolean(process.env.AGENCYX_API_KEY)}
      />
    </div>
  )
}
