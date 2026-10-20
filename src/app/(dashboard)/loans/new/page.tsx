export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getBankTieups, getDSAs } from '@/lib/loans/queries'
import PageHeader from '@/components/ui/PageHeader'
import LoanApplicationForm from '@/components/loans/LoanApplicationForm'

export default async function NewLoanApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; booking_id?: string }>
}) {
  const { client_id, booking_id } = await searchParams
  const supabase = await createClient()

  const [{ data: clients }, { data: bookings }, banks, dsas] = await Promise.all([
    supabase.from('clients').select('id, full_name, phone').order('full_name').limit(500),
    supabase.from('bookings').select('id, client_id, booking_number').order('created_at', { ascending: false }).limit(500),
    getBankTieups(true),
    getDSAs(true),
  ])

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="New Loan Application" subtitle="Start a home-loan file for a client" backHref="/loans" />
      <LoanApplicationForm
        clients={clients ?? []}
        bookings={bookings ?? []}
        banks={banks.map((b) => ({ id: b.id, label: `${b.bank_name} — ${b.loan_product_name}` }))}
        dsas={dsas.map((d) => ({ id: d.id, label: d.firm_name ? `${d.name} (${d.firm_name})` : d.name }))}
        defaultClientId={client_id}
        defaultBookingId={booking_id}
      />
    </div>
  )
}
