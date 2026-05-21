import { getActiveAdvisors, getProjects } from '@/lib/leads/queries'
import LeadForm from '@/components/leads/LeadForm'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/ui/PageHeader'

export default async function NewLeadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('branch_id')
    .eq('id', user.id)
    .single()

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
