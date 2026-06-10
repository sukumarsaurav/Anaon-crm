export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { getProfile } from '@/lib/supabase/getProfile'
import { getLeads, getActiveAdvisors } from '@/lib/leads/queries'
import PageHeader from '@/components/ui/PageHeader'
import OverdueLeadsTable from '@/components/leads/OverdueLeadsTable'

export default async function OverdueLeadsPage() {
  const session = await getProfile()
  const role = session?.profile?.role
  // Manager tool — sales advisors manage their own follow-ups from /leads.
  if (role !== 'admin' && role !== 'manager') notFound()

  const [leads, advisors] = await Promise.all([
    getLeads({ view: 'overdue', sort_by: 'next_followup_at', sort_dir: 'asc' }),
    getActiveAdvisors(session?.profile?.branch_id ?? undefined),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/leads"
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={22} />
            Overdue Follow-ups
            {leads.length > 0 && (
              <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                {leads.length}
              </span>
            )}
          </span>
        }
        subtitle="Follow-ups that are past due and need attention. Reassign or check in."
      />

      <OverdueLeadsTable leads={leads} advisors={advisors} />
    </div>
  )
}
