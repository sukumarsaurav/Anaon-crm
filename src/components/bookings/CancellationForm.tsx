'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelBooking } from '@/lib/bookings/actions'
import { formatCurrency } from '@/lib/utils'

interface Props {
  bookingId: string
  totalValue: number
}

export default function CancellationForm({ bookingId, totalValue }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await cancelBooking(bookingId, formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else {
        router.push(`/bookings/${bookingId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Cancellation Details</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Reason for Cancellation <span className="text-red-500">*</span>
        </label>
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="Describe the reason for cancellation..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Cancellation Charges (₹)
        </label>
        <input
          type="number"
          name="cancellation_charges"
          min={0}
          max={totalValue}
          step={0.01}
          placeholder="0"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
        />
        <p className="text-xs text-slate-500 mt-1">Leave blank if no charges. Max: {formatCurrency(totalValue)}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
        >
          Go Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Cancelling...' : 'Confirm Cancellation'}
        </button>
      </div>
    </form>
  )
}
