'use client'

import { useState, startTransition } from 'react'
import { registerBrokerLead } from '@/lib/brokers/actions'

interface Project {
  id: string
  name: string
  city: string
}

interface Props {
  projects: Project[]
  onDone?: (isDuplicate: boolean) => void
}

export default function BrokerLeadForm({ projects, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ isDuplicate: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setLoading(true)
    setError(null)
    setResult(null)

    startTransition(async () => {
      const res = await registerBrokerLead(formData)
      setLoading(false)
      if (!res.success) {
        setError(res.error ?? 'Something went wrong')
      } else {
        setResult({ isDuplicate: res.isDuplicate ?? false })
        form.reset()
        onDone?.(res.isDuplicate ?? false)
      }
    })
  }

  if (result) {
    return (
      <div className={`rounded-xl p-5 border ${result.isDuplicate ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
        {result.isDuplicate ? (
          <>
            <p className="font-semibold text-amber-800">Duplicate Lead Detected</p>
            <p className="text-sm text-amber-700 mt-1">
              This phone number already exists in our system. Your registration has been recorded. Commission eligibility follows FIFO rules — please contact ANON INDIA for clarification.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-green-800">Lead Registered Successfully!</p>
            <p className="text-sm text-green-700 mt-1">
              Your lead has been submitted to ANON INDIA. An advisor will be assigned and you will receive stage updates here.
            </p>
          </>
        )}
        <button onClick={() => setResult(null)}
          className="mt-3 px-3 py-1.5 text-sm border border-current rounded-lg hover:opacity-80">
          Register Another Lead
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Register New Lead</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input name="client_name" required placeholder="Full name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input name="client_phone" type="tel" required placeholder="+91 98765 43210"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Project Interest</label>
        <select name="project_id"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
          <option value="">Not specified</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {p.city}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Budget Min (₹)</label>
          <input name="budget_min" type="number" min="0" step="100000" placeholder="5000000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Budget Max (₹)</label>
          <input name="budget_max" type="number" min="0" step="100000" placeholder="10000000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea name="notes" rows={2} placeholder="Any additional details about the client..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={loading}
        className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {loading ? 'Registering...' : 'Register Lead'}
      </button>
    </form>
  )
}
