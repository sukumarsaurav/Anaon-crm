import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BOOKING_STATUS_CONFIG } from '@/types/clients'
import type { Booking, PaymentSummary } from '@/types/clients'
import { ArrowRight } from 'lucide-react'

interface Props {
  booking: Booking
  summary: PaymentSummary
}

export default function BookingSummaryCard({ booking, summary }: Props) {
  const cfg = BOOKING_STATUS_CONFIG[booking.status]
  const paidPct = summary.total_due > 0
    ? Math.round((summary.total_paid / summary.total_due) * 100)
    : 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500 font-mono">{booking.booking_number}</p>
          <h3 className="font-bold text-slate-900 mt-0.5">
            {booking.project?.name ?? '—'}
          </h3>
          <p className="text-sm text-slate-600">
            Plot {booking.plot?.plot_number}
            {booking.plot?.size_sqyd ? ` · ${booking.plot.size_sqyd} sq yd` : ''}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
          {cfg.label}
        </span>
      </div>

      {/* Key fields */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Total Value</p>
          <p className="font-semibold text-slate-900">{formatCurrency(booking.total_sale_value)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Booking Amount</p>
          <p className="font-semibold text-slate-900">{formatCurrency(booking.booking_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Booking Date</p>
          <p className="font-medium text-slate-700">{formatDate(booking.booking_date)}</p>
        </div>
        {booking.expected_possession_date && (
          <div>
            <p className="text-xs text-slate-500">Possession</p>
            <p className="font-medium text-slate-700">{formatDate(booking.expected_possession_date)}</p>
          </div>
        )}
      </div>

      {/* Payment bar */}
      <div className="bg-slate-50 rounded-lg p-3 mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Payment Progress</span>
          <span>{paidPct}% paid</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-green-700 font-medium">Paid: {formatCurrency(summary.total_paid)}</span>
          <span className="text-red-600 font-medium">Outstanding: {formatCurrency(summary.outstanding)}</span>
        </div>
        {summary.overdue_count > 0 && (
          <p className="text-xs text-red-600 mt-1 font-medium">
            {summary.overdue_count} overdue installment{summary.overdue_count > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <Link
        href={`/clients/${booking.client_id}/bookings/${booking.id}/payments`}
        className="flex items-center justify-between w-full px-3 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100"
      >
        <span>View Payment Schedule</span>
        <ArrowRight size={15} />
      </Link>
    </div>
  )
}
