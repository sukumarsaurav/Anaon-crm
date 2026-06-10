export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { getActiveAdvisors } from '@/lib/leads/queries'
import PageHeader from '@/components/ui/PageHeader'
import CsvImport from '@/components/leads/CsvImport'

export default async function LeadsImportPage() {
  const session = await getProfile()
  const role = session?.profile?.role
  if (role !== 'admin' && role !== 'manager') notFound()

  const advisors = await getActiveAdvisors(session?.profile?.branch_id ?? undefined)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref="/leads"
        title="Import Leads from CSV"
        subtitle="Upload a CSV, map the columns, and bulk-add leads. Duplicates are skipped by phone."
      />
      <CsvImport advisors={advisors.map((a) => ({ id: a.id, full_name: a.full_name }))} />
    </div>
  )
}
