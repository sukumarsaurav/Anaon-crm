export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getActiveBrokers } from '@/lib/bookings/queries'
import BookingCreateForm from '@/components/bookings/BookingCreateForm'
import PageHeader from '@/components/ui/PageHeader'

export default async function NewBookingPage() {
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
        subtitle="Convert a lead / client to a confirmed booking"
      />

      <BookingCreateForm
        clients={clients ?? []}
        projects={projects ?? []}
        advisors={advisors ?? []}
        brokers={brokers}
      />
    </div>
  )
}
