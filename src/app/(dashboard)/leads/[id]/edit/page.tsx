import { notFound } from 'next/navigation'
import { getLeadById, getActiveAdvisors, getProjects } from '@/lib/leads/queries'
import LeadForm from '@/components/leads/LeadForm'
import { getProfile } from '@/lib/supabase/getProfile'
import PageHeader from '@/components/ui/PageHeader'

interface EditLeadPageProps {
  params: Promise<{ id: string }>
}

export default async function EditLeadPage({ params }: EditLeadPageProps) {
  const { id } = await params
  const user = (await getProfile())?.user
  if (!user) return null

  const profile = (await getProfile())?.profile

  const [lead, projects, advisors] = await Promise.all([
    getLeadById(id),
    getProjects(),
    getActiveAdvisors(profile?.branch_id ?? undefined),
  ])

  if (!lead) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        backHref={`/leads/${id}`}
        title="Edit Lead"
        subtitle={lead.full_name}
      />
      <LeadForm lead={lead} projects={projects as never} advisors={advisors} />
    </div>
  )
}
