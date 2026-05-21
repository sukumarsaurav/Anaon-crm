'use client'

import { useState, useTransition } from 'react'
import { addBookingInstallment, deleteBookingInstallment } from '@/lib/bookings/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAYMENT_STATUS_CONFIG } from '@/types/clients'
import type { Payment } from '@/types/clients'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  bookingId:    string
  clientId:     string
  totalValue:   number
  payments:     Payment[]
  canManage:    boolean
}

export default function PaymentPlanBuilder({ bookingId, clientId, totalValue, payments, canManage }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const totalScheduled = payments.reduce((s, p) => s + p.amount_due, 0)
  const totalPaid      = payments.reduce((s, p) => s + (p.amount_paid ?? 0), 0)
  const balance        = totalValue - totalScheduled

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('booking_id', bookingId)
    fd.set('client_id', clientId)
    setError(null)
    startTransition(async () => {
      const result = await addBookingInstallment(fd)
      if (result.success) {
        setShowAdd(false)
        ;(e.target as HTMLFormElement).reset()
      } else setError(result.error ?? 'Failed')
    })
  }

  function handleDelete(paymentId: string) {
    if (!confirm('Delete this installment?')) return
    startTransition(async () => {
      const result = await deleteBookingInstallment(paymentId, bookingId)
      if (!result.success) setError(result.error ?? 'Failed')
    })
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-slate-800">{formatCurrency(totalScheduled)}</p>
          <p className="text-xs text-slate-500">Scheduled</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-slate-500">Received</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${balance < 0 ? 'bg-red-50' : balance > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
          <p className={`text-lg font-bold ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
            {formatCurrency(Math.abs(balance))}
          </p>
          <p className="text-xs text-slate-500">{balance < 0 ? 'Over-scheduled' : balance > 0 ? 'Unscheduled' : 'Balanced'}</p>
        </div>
      </div>

      {/* Add form */}
      {canManage && showAdd && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-indigo-50 rounded-xl space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
              <input name="amount_due" type="number" min="1" required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label>
              <input name="due_date" type="date" required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input name="description" placeholder="Booking amount / EMI..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
              {isPending ? 'Adding...' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {canManage && !showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-3">
          <Plus size={15} /> Add Installment
        </button>
      )}

      {/* Installment list */}
      <div className="space-y-2">
        {payments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No installments scheduled yet</p>
        )}
        {payments.map((p) => {
          const today = new Date().toISOString().split('T')[0]
          const isOverdue = p.status === 'pending' && p.due_date < today
          const key = isOverdue ? 'overdue' : p.status
          const cfg = PAYMENT_STATUS_CONFIG[key as keyof typeof PAYMENT_STATUS_CONFIG] ?? PAYMENT_STATUS_CONFIG.pending

          return (
            <div key={p.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">
                    #{p.installment_number} — {formatCurrency(p.amount_due)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                    {isOverdue ? 'Overdue' : cfg.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Due: {formatDate(p.due_date)}
                  {p.description ? ` · ${p.description}` : ''}
                </p>
                {p.status === 'paid' && p.paid_date && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Paid {formatDate(p.paid_date)} · {formatCurrency(p.amount_paid)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3">
                {canManage && p.status !== 'paid' && (
                  <button onClick={() => handleDelete(p.id)} disabled={isPending}
                    className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-40">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
