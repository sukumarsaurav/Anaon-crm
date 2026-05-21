'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBroker, updateBroker } from '@/lib/brokers/actions'
import type { Broker } from '@/types/brokers'

interface Props {
  broker?: Broker
}

export default function BrokerForm({ broker }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = broker
        ? await updateBroker(broker.id, formData)
        : await createBroker(formData)

      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
        setLoading(false)
      } else {
        router.push(broker ? `/brokers/${broker.id}` : `/brokers/${'id' in result ? result.id : ''}`)
        router.refresh()
      }
    })
  }

  const field = (
    name: string,
    label: string,
    opts?: { type?: string; required?: boolean; placeholder?: string; min?: string; step?: string }
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type={opts?.type ?? 'text'}
        required={opts?.required}
        placeholder={opts?.placeholder}
        min={opts?.min}
        step={opts?.step}
        defaultValue={broker ? String((broker as unknown as Record<string, unknown>)[name] ?? '') : ''}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identity */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('full_name',   'Full Name',   { required: true, placeholder: 'Rajesh Kumar' })}
          {field('firm_name',   'Firm / Agency Name', { placeholder: 'Kumar Realty Pvt Ltd' })}
          {field('email',       'Email Address',      { type: 'email', placeholder: 'broker@example.com' })}
          {field('phone',       'Phone Number',       { type: 'tel', placeholder: '+91 98765 43210' })}
          {field('rera_number', 'RERA Number',        { placeholder: 'RERA/XXX/00000' })}
          {field('gstin',       'GSTIN',              { placeholder: '29AAAAA0000A1Z5' })}
        </div>
      </div>

      {/* Location */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Location</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('city', 'City', { placeholder: 'Jaipur' })}
          <div className="sm:col-span-2">
            {field('address', 'Full Address', { placeholder: 'Office address...' })}
          </div>
        </div>
      </div>

      {/* Commission */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Commission</h3>
        {field('commission_rate', 'Commission Rate (%)', {
          type: 'number', required: true, placeholder: '2', min: '0', step: '0.01'
        })}
      </div>

      {/* Bank Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Bank Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field('bank_name',      'Bank Name',       { placeholder: 'HDFC Bank' })}
          {field('account_number', 'Account Number',  { placeholder: 'XXXXXXXXXXX' })}
          {field('ifsc',           'IFSC Code',       { placeholder: 'HDFC0001234' })}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Internal Notes</h3>
        <textarea
          name="notes"
          rows={2}
          defaultValue={broker?.notes ?? ''}
          placeholder="Any internal notes about this broker..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Saving...' : broker ? 'Save Changes' : 'Add Broker'}
        </button>
      </div>
    </form>
  )
}
