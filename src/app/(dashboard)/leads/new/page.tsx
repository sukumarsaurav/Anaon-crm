import { getActiveAdvisors, getProjects } from '@/lib/leads/queries'
import LeadForm from '@/components/leads/LeadForm'
import { getProfile } from '@/lib/supabase/getProfile'
import PageHeader from '@/components/ui/PageHeader'

export default async function NewLeadPage() {
  const user = (await getProfile())?.user
  if (!user) return null

  const profile = (await getProfile())?.profile

  const [projects, advisors] = await Promise.all([
    getProjects(),
    getActiveAdvisors(profile?.branch_id ?? undefined),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        backHref="/leads"
        title="New Lead"
        subtitle="Fill in the details to create a new lead record"
      />
      <LeadForm projects={projects as never} advisors={advisors} />
    </div>
  )
}
