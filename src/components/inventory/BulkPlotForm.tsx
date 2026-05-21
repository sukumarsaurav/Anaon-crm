'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBulkPlots } from '@/lib/inventory/actions'
import { formatCurrency } from '@/lib/utils'

interface Props {
  projectId: string
}

export default function BulkPlotForm({ projectId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [prefix, setPrefix] = useState('A-')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(50)
  const [basePrice, setBasePrice] = useState(0)
  const [devCharges, setDevCharges] = useState(0)
  const [sizeQyd, setSizeQyd] = useState('')

  const count = Math.max(0, to - from + 1)
  const preview = count > 0
    ? `${prefix}${from}, ${prefix}${from + 1}, ... ${prefix}${to}`
    : 'Invalid range'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('project_id', projectId)
    setError(null)
    startTransition(async () => {
      const result = await createBulkPlots(formData)
      if (result.success) {
        router.push(`/inventory/${projectId}`)
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Prefix</label>
          <input name="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)}
            placeholder="A-"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From #</label>
          <input name="from_number" type="number" min="1" value={from}
            onChange={(e) => setFrom(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To #</label>
          <input name="to_number" type="number" min="1" value={to}
            onChange={(e) => setTo(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
        <strong>{count}</strong> plots will be created: <span className="font-mono text-xs">{preview}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Size (sq yards)</label>
          <input name="size_sqyd" type="number" step="0.01" value={sizeQyd}
            onChange={(e) => setSizeQyd(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Base Price (₹) *</label>
          <input name="base_price" type="number" min="0" required value={basePrice || ''}
            onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Dev. Charges (₹)</label>
          <input name="development_charges" type="number" min="0" value={devCharges || ''}
            onChange={(e) => setDevCharges(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex items-end">
          <div className="w-full p-2 bg-slate-50 rounded-lg text-sm text-center">
            Total/plot: <strong className="text-indigo-700">{formatCurrency(basePrice + devCharges, { mode: 'exact' })}</strong>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending || count === 0}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
          {isPending ? 'Creating...' : `Create ${count} Plots`}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
