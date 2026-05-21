'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDSA, updateDSA, toggleDSA } from '@/lib/loans/actions'
import type { DSA } from '@/types/loans'
import { Plus, X, Pencil } from 'lucide-react'

interface Props { dsa?: DSA }

export function DSAFormButton({ dsa }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = dsa ? await updateDSA(dsa.id, fd) : await createDSA(fd)
      setLoading(false)
      if (result.success) { setOpen(false); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  if (!open) {
    return dsa ? (
      <button onClick={() => setOpen(true)} className="text-indigo-600 hover:text-indigo-800">
        <Pencil size={14} />
      </button>
    ) : (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
        <Plus size={15} /> Add DSA
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">{dsa ? 'Edit DSA' : 'New DSA'}</h3>
        <button onClick={() => setOpen(false)}><X size={16} className="text-slate-400" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-500">*</span></label>
            <input name="name" required defaultValue={dsa?.name ?? ''} placeholder="Agent full name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Firm Name</label>
            <input name="firm_name" defaultValue={dsa?.firm_name ?? ''} placeholder="Agency / firm name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input type="tel" name="contact_phone" defaultValue={dsa?.contact_phone ?? ''} placeholder="+91 98765 43210"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" name="contact_email" defaultValue={dsa?.contact_email ?? ''} placeholder="dsa@example.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
            <input name="city" defaultValue={dsa?.city ?? ''} placeholder="Jaipur"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commission Rate (%)</label>
            <input type="number" step="0.01" name="commission_rate" defaultValue={dsa?.commission_rate ?? ''} placeholder="0.5"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Bank Empanelments (comma-separated)</label>
            <input name="bank_empanelments" defaultValue={(dsa?.bank_empanelments ?? []).join(', ')} placeholder="SBI, HDFC, ICICI"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={dsa?.notes ?? ''} placeholder="Specialties, remarks..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save DSA'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </div>
  )
}

export function DSAToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  function handle() {
    startTransition(async () => {
      await toggleDSA(id, !isActive)
      router.refresh()
    })
  }
  return (
    <button onClick={handle}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        isActive ? 'bg-indigo-600' : 'bg-slate-200'
      }`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        isActive ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
  )
}
