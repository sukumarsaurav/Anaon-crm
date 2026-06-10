export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getBookingById } from '@/lib/bookings/queries'
import { getProfile } from '@/lib/supabase/getProfile'
import { formatCurrency, formatDate } from '@/lib/utils'
import CancellationForm from '@/components/bookings/CancellationForm'
import BookingStatusBadge from '@/components/bookings/BookingStatusBadge'
import PageHeader from '@/components/ui/PageHeader'
import Alert from '@/components/ui/Alert'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CancelBookingPage({ params }: PageProps) {
  const { id } = await params

  const profile = (await getProfile())?.profile

  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect(`/bookings/${id}`)

  const booking = await getBookingById(id)
  if (!booking) notFound()
  if (booking.status === 'cancelled') redirect(`/bookings/${id}`)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader
        backHref={`/bookings/${id}`}
        title="Cancel Booking"
        subtitle={`${booking.booking_number} · ${booking.client?.full_name}`}
      />

      {/* Booking summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Booking Summary</h3>
          <BookingStatusBadge status={booking.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm pt-2">
          <div><p className="text-xs text-slate-500">Client</p><p className="font-medium">{booking.client?.full_name}</p></div>
          <div><p className="text-xs text-slate-500">Project / Plot</p><p className="font-medium">{booking.project?.name} · {booking.plot?.plot_number}</p></div>
          <div><p className="text-xs text-slate-500">Total Value</p><p className="font-bold text-indigo-700">{formatCurrency(booking.total_sale_value)}</p></div>
          <div><p className="text-xs text-slate-500">Booking Date</p><p className="font-medium">{formatDate(booking.booking_date)}</p></div>
        </div>
      </div>

      <Alert variant="error" title="This action cannot be undone.">
        <ul className="mt-1 space-y-1 list-disc list-inside">
          <li>The plot will be reset to <strong>Available</strong></li>
          <li>Any broker commission will be <strong>voided</strong></li>
          <li>The booking record is archived (not deleted)</li>
          <li>All collected payments remain in records for accounting</li>
        </ul>
      </Alert>

      <CancellationForm bookingId={id} totalValue={booking.total_sale_value} />
    </div>
  )
}
