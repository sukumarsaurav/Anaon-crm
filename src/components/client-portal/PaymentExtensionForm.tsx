'use client'

import { useState, startTransition } from 'react'
import { requestPaymentExtension } from '@/lib/portal/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface Props {
  paymentId: string
  bookingId: string
  clientId: string
  amountDue: number
  dueDate: string
}

export default function PaymentExtensionForm({ paymentId, bookingId, clientId, amountDue, dueDate }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await requestPaymentExtension(clientId, formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
      } else {
        setDone(true)
        setOpen(false)
      }
    })
  }

  if (done) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
        Extension request submitted. Our team will review and contact you.
      </p>
    )
  }

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
        Request payment extension <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 p-3 bg-slate-50 rounded-lg space-y-3 border border-slate-200">
          <input type="hidden" name="payment_id" value={paymentId} />
          <input type="hidden" name="booking_id" value={bookingId} />
          <p className="text-xs text-slate-600">
            Requesting extension for: <strong>{formatCurrency(amountDue)}</strong> due {formatDate(dueDate)}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Requested new date <span className="text-red-500">*</span></label>
            <input type="date" name="requested_date" required min={dueDate}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea name="reason" required rows={2} placeholder="Briefly explain why you need an extension..."
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}
    </div>
  )
}
