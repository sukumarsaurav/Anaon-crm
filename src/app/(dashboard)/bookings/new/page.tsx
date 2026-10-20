export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getActiveBrokers } from '@/lib/bookings/queries'
import BookingCreateForm from '@/components/bookings/BookingCreateForm'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'New Booking' }

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ client_id?: string }> }) {
  const { client_id } = await searchParams
  const supabase = await createClient()

  const [
    { data: clients },
    { data: projects },
    { data: advisors },
    brokers,
  ] = await Promise.all([
    supabase.from('clients').select('id, full_name, phone').order('full_name'),
    supabase.from('projects').select('id, name, city').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name').in('role', ['sales_advisor', 'manager', 'admin']).eq('is_active', true).order('full_name'),
    getActiveBrokers(),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        backHref="/bookings"
        title="New Booking"
        subtitle="Book a plot for a client (convert a lead to a client first)"
      />

      <BookingCreateForm
        clients={clients ?? []}
        projects={projects ?? []}
        advisors={advisors ?? []}
        brokers={brokers}
        defaultClientId={client_id}
      />
    </div>
  )
}
