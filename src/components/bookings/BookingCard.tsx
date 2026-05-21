import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import BookingStatusBadge from './BookingStatusBadge'
import type { BookingFull } from '@/types/bookings'
import { Building2, User, Calendar } from 'lucide-react'

interface Props {
  booking: BookingFull
}

export default function BookingCard({ booking }: Props) {
  return (
    <Card href={`/bookings/${booking.id}`} padding="sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs text-slate-400 font-mono">{booking.booking_number}</p>
          <h3 className="font-semibold text-slate-900 text-sm mt-0.5">
            {booking.client?.full_name ?? '—'}
          </h3>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      <div className="space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="shrink-0" />
          <span className="truncate">
            {booking.project?.name} · Plot {booking.plot?.plot_number}
            {booking.plot?.size_sqyd ? ` (${booking.plot.size_sqyd} sq yd)` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <User size={14} className="shrink-0" />
          <span>{booking.advisor?.full_name ?? 'No advisor'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="shrink-0" />
          <span>{formatDate(booking.booking_date)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-400">Total Value</p>
          <p className="text-sm font-bold text-indigo-700">{formatCurrency(booking.total_sale_value)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Booking Amt</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrency(booking.booking_amount)}</p>
        </div>
      </div>
    </Card>
  )
}
