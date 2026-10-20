'use client'

import { useMemo, useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLoanApplication } from '@/lib/loans/actions'

interface Props {
  clients: { id: string; full_name: string; phone: string }[]
  bookings: { id: string; client_id: string; booking_number: string }[]
  banks: { id: string; label: string }[]
  dsas: { id: string; label: string }[]
  defaultClientId?: string
  defaultBookingId?: string
}

const input = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const label = 'block text-xs font-medium text-slate-600 mb-1'

export default function LoanApplicationForm({ clients, bookings, banks, dsas, defaultClientId, defaultBookingId }: Props) {
  const router = useRouter()
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientBookings = useMemo(() => bookings.filter((b) => b.client_id === clientId), [bookings, clientId])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createLoanApplication(fd)
      setLoading(false)
      if (res.success && res.id) router.push(`/loans/${res.id}`)
      else setError(res.error ?? 'Could not create the application')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Client <span className="text-red-500">*</span></label>
          <select name="client_id" required value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Booking</label>
          <select name="booking_id" defaultValue={defaultBookingId ?? ''} className={input} disabled={!clientId}>
            <option value="">No booking linked</option>
            {clientBookings.map((b) => <option key={b.id} value={b.id}>{b.booking_number}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Bank / product</label>
          <select name="bank_tieup_id" className={input}>
            <option value="">Decide later</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>DSA</label>
          <select name="dsa_id" className={input}>
            <option value="">None</option>
            {dsas.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Loan amount applied (₹)</label>
          <input name="loan_amount_applied" type="number" min="0" step="1" className={input} />
        </div>
        <div>
          <label className={label}>Monthly income (₹)</label>
          <input name="monthly_income" type="number" min="0" step="1" className={input} />
        </div>
        <div>
          <label className={label}>Existing EMIs (₹/month)</label>
          <input name="existing_emis" type="number" min="0" step="1" className={input} />
        </div>
        <div>
          <label className={label}>Credit score</label>
          <input name="credit_score" type="number" min="300" max="900" className={input} />
        </div>
      </div>
      <div>
        <label className={label}>Notes</label>
        <textarea name="notes" rows={3} className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {loading ? 'Creating…' : 'Create application'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </form>
  )
}
