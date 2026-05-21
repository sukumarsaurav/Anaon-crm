export const dynamic = 'force-dynamic'

import { getAutoReplyRules } from '@/lib/whatsapp/queries'
import AutoReplyRuleList from '@/components/whatsapp/AutoReplyRuleList'
import PageHeader from '@/components/ui/PageHeader'

export default async function AutoReplyPage() {
  const rules = await getAutoReplyRules()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Auto-Reply Rules"
        subtitle="Automatically respond to inbound messages based on triggers like keywords, office hours, or new contacts"
      />

      <AutoReplyRuleList rules={rules} />
    </div>
  )
}
