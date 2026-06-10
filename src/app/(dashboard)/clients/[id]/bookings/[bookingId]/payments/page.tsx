export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getClientById, getBookingPayments, getPaymentSummary } from '@/lib/clients/queries'
import { createClient as createSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import PaymentSchedule from '@/components/clients/PaymentSchedule'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'

interface PageProps {
  params: Promise<{ id: string; bookingId: string }>
}

export default async function BookingPaymentsPage({ params }: PageProps) {
  const { id, bookingId } = await params

  const supabase = await createSupabase()
  const profile = (await getProfile())?.profile
  const canManage = ['admin', 'manager'].includes(profile?.role ?? '')

  const [client, payments, summary] = await Promise.all([
    getClientById(id),
    getBookingPayments(bookingId),
    getPaymentSummary(bookingId),
  ])
  if (!client) notFound()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, plot:plots!bookings_plot_id_fkey(plot_number), project:projects!bookings_project_id_fkey(name)')
    .eq('id', bookingId)
    .eq('client_id', id)
    .single()
  if (!booking) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref={`/clients/${id}?tab=payments`}
        title="Payment Schedule"
        subtitle={`${client.full_name} · ${booking.booking_number} · ${booking.project?.name} · Plot ${booking.plot?.plot_number}`}
      />

      {/* Booking summary strip */}
      <Card padding="sm" className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Total Sale Value</p>
          <p className="font-semibold text-slate-900">{formatCurrency(booking.total_sale_value)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Payment Plan</p>
          <p className="font-medium text-slate-700">{booking.payment_plan ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Booking Date</p>
          <p className="font-medium text-slate-700">{formatDate(booking.booking_date)}</p>
        </div>
        {booking.expected_possession_date && (
          <div>
            <p className="text-xs text-slate-500">Possession Date</p>
            <p className="font-medium text-slate-700">{formatDate(booking.expected_possession_date)}</p>
          </div>
        )}
      </Card>

      <PaymentSchedule
        bookingId={bookingId}
        clientId={id}
        payments={payments}
        summary={summary}
        canManage={canManage}
      />
    </div>
  )
}
