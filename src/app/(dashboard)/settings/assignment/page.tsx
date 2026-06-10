export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { getActiveAdvisors } from '@/lib/leads/queries'
import { getAssignmentRules } from '@/lib/leads/assignmentRules'
import PageHeader from '@/components/ui/PageHeader'
import AssignmentRulesManager from '@/components/settings/AssignmentRulesManager'

export default async function AssignmentSettingsPage() {
  const role = (await getProfile())?.profile?.role
  if (role !== 'admin') notFound()

  const [rules, advisors] = await Promise.all([getAssignmentRules(), getActiveAdvisors()])

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref="/settings"
        title="Lead Assignment Rules"
        subtitle="Route incoming leads to the right rep automatically. Rules run top to bottom — the first match wins; unmatched leads fall back to round-robin."
      />
      <AssignmentRulesManager
        initialRules={rules}
        advisors={advisors.map((a) => ({ id: a.id, full_name: a.full_name, role: a.role }))}
      />
    </div>
  )
}
