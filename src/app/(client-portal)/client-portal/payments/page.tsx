export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalSession, getPortalClientData } from '@/lib/portal/queries'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAYMENT_STATUS_CONFIG } from '@/types/clients'
import PaymentExtensionForm from '@/components/client-portal/PaymentExtensionForm'
import type { PaymentStatus } from '@/types/clients'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default async function ClientPortalPaymentsPage() {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const data = await getPortalClientData(session.client.id)
  const { payments, paymentSummary, booking } = data

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment Schedule</h1>
        <p className="text-sm text-slate-500 mt-0.5">{booking?.booking_number ?? 'No booking'}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Paid',        value: formatCurrency(paymentSummary.total_paid),    icon: CheckCircle, color: 'text-green-600' },
          { label: 'Outstanding', value: formatCurrency(paymentSummary.outstanding),   icon: Clock,       color: 'text-amber-600' },
          { label: 'Total',       value: formatCurrency(paymentSummary.total_due),     icon: AlertCircle, color: 'text-indigo-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <Icon size={18} className={`${color} mx-auto mb-1`} />
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {paymentSummary.total_due > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Payment Progress</span>
            <span>{Math.round((paymentSummary.total_paid / paymentSummary.total_due) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div className="bg-indigo-600 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round((paymentSummary.total_paid / paymentSummary.total_due) * 100))}%` }} />
          </div>
        </div>
      )}

      {/* Installment list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900 text-sm">All Installments</h3>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No payment schedule found. Contact ANON INDIA.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((p) => {
              const isOverdue = p.status === 'pending' && p.due_date < today
              const cfg = PAYMENT_STATUS_CONFIG[p.status as PaymentStatus]
              return (
                <div key={p.id} className={`p-4 ${isOverdue ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">
                          #{p.installment_number} {p.description ? `· ${p.description}` : ''}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>
                          {cfg?.label}
                        </span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium text-red-700 bg-red-100">Overdue</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Due: {formatDate(p.due_date)}</p>
                      {p.paid_date && <p className="text-xs text-green-600">Paid: {formatDate(p.paid_date)}</p>}
                      {p.transaction_id && <p className="text-xs text-slate-400">Txn: {p.transaction_id}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-900">{formatCurrency(p.amount_due)}</p>
                      {p.amount_paid && p.amount_paid > 0 && (
                        <p className="text-xs text-green-600">Paid: {formatCurrency(p.amount_paid)}</p>
                      )}
                    </div>
                  </div>
                  {/* Extension request */}
                  {p.status === 'pending' && booking && (
                    <div className="mt-3">
                      <PaymentExtensionForm paymentId={p.id} bookingId={booking.id} clientId={session.client.id} amountDue={p.amount_due} dueDate={p.due_date} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-1">Need help with a payment?</p>
        <p>Contact your dedicated ANON INDIA advisor or visit the Support section. For online payment, reach out to our accounts team for a payment link.</p>
      </div>
    </div>
  )
}
