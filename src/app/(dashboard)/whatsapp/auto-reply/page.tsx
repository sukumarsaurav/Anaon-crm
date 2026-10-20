export const dynamic = 'force-dynamic'

import { getAutoReplyRules } from '@/lib/whatsapp/queries'
import AutoReplyRuleList from '@/components/whatsapp/AutoReplyRuleList'
import PageHeader from '@/components/ui/PageHeader'
import { activeWhatsAppProvider } from '@/lib/whatsapp/send'

export const metadata = { title: 'Auto-Reply Rules' }

export default async function AutoReplyPage() {
  const rules = await getAutoReplyRules()
  // With AgencyX connected it owns the number and answers chats with its own bot and
  // keyword rules; the CRM's rules only run on the direct Meta Cloud API webhook.
  const viaAgencyX = activeWhatsAppProvider() === 'agencyx'

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Auto-Reply Rules"
        subtitle="Automatically respond to inbound messages based on triggers like keywords, office hours, or new contacts"
      />

      {viaAgencyX && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          WhatsApp is connected through AgencyX, which answers chats with its own bot and keyword rules.
          The rules below are <strong>not applied</strong> to those chats (the CRM does not reply a second time).
          Manage automatic replies in AgencyX; these rules only run for a direct Meta Cloud API connection.
        </div>
      )}

      <AutoReplyRuleList rules={rules} />
    </div>
  )
}
