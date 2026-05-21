'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBankTieup, updateBankTieup, toggleBankTieup } from '@/lib/loans/actions'
import type { BankTieup } from '@/types/loans'
import { Plus, X, Pencil } from 'lucide-react'

interface Props { bank?: BankTieup }

export function BankTieupFormButton({ bank }: Props) {
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
      const result = bank
        ? await updateBankTieup(bank.id, fd)
        : await createBankTieup(fd)
      setLoading(false)
      if (result.success) { setOpen(false); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  if (!open) {
    return bank ? (
      <button onClick={() => setOpen(true)} className="text-indigo-600 hover:text-indigo-800">
        <Pencil size={14} />
      </button>
    ) : (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
        <Plus size={15} /> Add Bank
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">{bank ? 'Edit Bank Tie-up' : 'New Bank Tie-up'}</h3>
        <button onClick={() => setOpen(false)}><X size={16} className="text-slate-400" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Bank / NBFC Name <span className="text-red-500">*</span></label>
            <input name="bank_name" required defaultValue={bank?.bank_name ?? ''} placeholder="SBI / HDFC / LIC HFL"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Loan Product Name <span className="text-red-500">*</span></label>
            <input name="loan_product_name" required defaultValue={bank?.loan_product_name ?? ''} placeholder="Home Loan / NRI Loan"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max Loan % of Value</label>
            <input type="number" step="0.01" name="max_loan_pct" defaultValue={bank?.max_loan_pct ?? ''} placeholder="75"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Interest Rate (%)</label>
            <div className="flex gap-2">
              <input type="number" step="0.01" name="interest_rate" defaultValue={bank?.interest_rate ?? ''} placeholder="8.5"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select name="interest_type" defaultValue={bank?.interest_type ?? 'floating'}
                className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="floating">Floating</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Processing Fee (₹)</label>
            <input type="number" name="processing_fee" defaultValue={bank?.processing_fee ?? ''} placeholder="10000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">TAT (days for sanction)</label>
            <input type="number" name="turnaround_days" defaultValue={bank?.turnaround_days ?? ''} placeholder="21"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">RM Name</label>
            <input name="rm_name" defaultValue={bank?.rm_name ?? ''} placeholder="Relationship manager name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">RM Phone</label>
            <input type="tel" name="rm_phone" defaultValue={bank?.rm_phone ?? ''} placeholder="+91 98765 43210"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">RM Email</label>
            <input type="email" name="rm_email" defaultValue={bank?.rm_email ?? ''} placeholder="rm@bank.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={bank?.notes ?? ''} placeholder="Special conditions, tie-up terms..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export function BankToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  function handle() {
    startTransition(async () => {
      await toggleBankTieup(id, !isActive)
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
