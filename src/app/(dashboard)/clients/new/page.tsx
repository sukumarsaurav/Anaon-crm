import { redirect } from 'next/navigation'
import ClientForm, { type LeadPrefill } from '@/components/clients/ClientForm'
import PageHeader from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'New Client' }

interface PageProps {
  searchParams: Promise<{ lead_id?: string }>
}

export default async function NewClientPage({ searchParams }: PageProps) {
  const { lead_id } = await searchParams

  // "Convert to client" from a lead: prefill from the lead, or open the client it already became.
  let prefill: LeadPrefill | undefined
  if (lead_id) {
    const supabase = await createClient()
    const [{ data: existing }, { data: lead }] = await Promise.all([
      supabase.from('clients').select('id').eq('lead_id', lead_id).maybeSingle(),
      supabase.from('leads').select('id, full_name, phone, alternate_phone, email').eq('id', lead_id).maybeSingle(),
    ])
    if (existing) redirect(`/clients/${existing.id}`)
    if (lead) prefill = { lead_id: lead.id, full_name: lead.full_name, phone: lead.phone, alternate_phone: lead.alternate_phone, email: lead.email }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        backHref={prefill ? `/leads/${prefill.lead_id}` : '/clients'}
        title={prefill ? 'Convert to Client' : 'New Client'}
        subtitle="Add a post-sale client profile"
      />
      <ClientForm prefill={prefill} />
    </div>
  )
}
