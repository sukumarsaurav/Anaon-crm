'use client'

import { useState, useTransition } from 'react'
import { recordPayment, addPaymentInstallment, waivePayment } from '@/lib/clients/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PAYMENT_STATUS_CONFIG, PAYMENT_MODE_LABELS,
} from '@/types/clients'
import type { Payment, PaymentSummary } from '@/types/clients'
import { CheckCircle2, Plus, X } from 'lucide-react'

interface Props {
  bookingId: string
  clientId:  string
  payments:  Payment[]
  summary:   PaymentSummary
  canManage: boolean
}

function RecordPaymentModal({
  payment, onClose,
}: { payment: Payment; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await recordPayment(payment.id, fd)
      if (result.success) onClose()
      else setError(result.error ?? 'Failed')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid (₹) *</label>
              <input name="amount_paid" type="number" min="0" step="1" required
                defaultValue={payment.amount_due}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date *</label>
              <input name="paid_date" type="date" required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
              <select name="mode"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— Select —</option>
                {Object.entries(PAYMENT_MODE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Transaction / UTR</label>
              <input name="transaction_id" placeholder="UTR123456"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cheque No.</label>
              <input name="cheque_number" placeholder="123456"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bank</label>
              <input name="bank_name" placeholder="Bank name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference</label>
              <input name="payment_reference" placeholder="Any reference"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input name="notes"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={isPending}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
              {isPending ? 'Saving...' : 'Record Payment'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PaymentSchedule({ bookingId, clientId, payments, summary, canManage }: Props) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAddInstallment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('booking_id', bookingId)
    fd.set('client_id', clientId)
    setError(null)
    startTransition(async () => {
      const result = await addPaymentInstallment(fd)
      if (result.success) setShowAddForm(false)
      else setError(result.error ?? 'Failed')
    })
  }

  function handleWaive(paymentId: string) {
    if (!confirm('Waive this installment?')) return
    startTransition(async () => { await waivePayment(paymentId) })
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Due',    value: formatCurrency(summary.total_due),   color: 'text-slate-800' },
          { label: 'Total Paid',   value: formatCurrency(summary.total_paid),   color: 'text-green-700' },
          { label: 'Outstanding',  value: formatCurrency(summary.outstanding),  color: 'text-indigo-700' },
          { label: 'Overdue',      value: `${summary.overdue_count} inst.`,     color: summary.overdue_count > 0 ? 'text-red-600' : 'text-slate-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add installment */}
      {canManage && (
        <div className="mb-4">
          {showAddForm ? (
            <form onSubmit={handleAddInstallment} className="p-4 bg-indigo-50 rounded-xl space-y-3 mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Add Installment</h4>
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
                  <input name="description" placeholder="Down payment"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={isPending}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
                  {isPending ? 'Adding...' : 'Add'}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)}
                  className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-3">
              <Plus size={15} /> Add Installment
            </button>
          )}
        </div>
      )}

      {/* Installment table */}
      <div className="space-y-2">
        {payments.map((p) => {
          const cfg = PAYMENT_STATUS_CONFIG[p.status]
          const isOverdue = p.status === 'pending' && p.due_date < new Date().toISOString().split('T')[0]
          const effectiveStatus = isOverdue ? 'overdue' : p.status
          const effectiveCfg = PAYMENT_STATUS_CONFIG[effectiveStatus]

          return (
            <div key={p.id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${effectiveCfg.border} ${effectiveCfg.bg}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">
                    #{p.installment_number} — {formatCurrency(p.amount_due)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${effectiveCfg.color} ${effectiveCfg.bg}`}>
                    {effectiveCfg.label}
                  </span>
                  {p.late_charge > 0 && (
                    <span className="text-xs text-red-500">+{formatCurrency(p.late_charge)} late</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Due: {formatDate(p.due_date)}
                  {p.description ? ` · ${p.description}` : ''}
                </p>
                {p.status === 'paid' && p.paid_date && (
                  <p className="text-xs text-green-600 mt-0.5">
                    <CheckCircle2 size={11} className="inline mr-1" />
                    Paid {formatDate(p.paid_date)}
                    {p.mode ? ` via ${PAYMENT_MODE_LABELS[p.mode]}` : ''}
                    {p.transaction_id ? ` · ${p.transaction_id}` : ''}
                  </p>
                )}
              </div>

              {canManage && p.status !== 'paid' && p.status !== 'waived' && (
                <div className="flex gap-2 ml-3 shrink-0">
                  <button
                    onClick={() => setSelectedPayment(p)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                    Record
                  </button>
                  <button
                    onClick={() => handleWaive(p.id)}
                    disabled={isPending}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 disabled:opacity-40">
                    Waive
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {payments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No installments scheduled yet</p>
        )}
      </div>

      {selectedPayment && (
        <RecordPaymentModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
      )}
    </div>
  )
}
