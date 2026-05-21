'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDisbursementTranche, updateDisbursementStatus } from '@/lib/loans/actions'
import type { LoanDisbursement, DisbursementStatus } from '@/types/loans'
import { DISBURSEMENT_STATUS_CONFIG } from '@/types/loans'
import { Plus, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  loanId: string
  disbursements: LoanDisbursement[]
  milestones: { id: string; name: string }[]
}

const fmt = (n: number | null) => formatCurrency(n, { mode: 'exact' })

export default function DisbursementManager({ loanId, disbursements, milestones }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [showMarkForm, setShowMarkForm] = useState<string | null>(null)

  function handleAddTranche(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddLoading(true)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await addDisbursementTranche(loanId, fd)
      setAddLoading(false)
      setShowAdd(false)
      router.refresh()
    })
  }

  function handleMark(disbId: string, status: DisbursementStatus, fd: FormData) {
    setMarkingId(disbId)
    startTransition(async () => {
      await updateDisbursementStatus(disbId, loanId, status, fd)
      setMarkingId(null)
      setShowMarkForm(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {disbursements.length > 0 && (
        <div className="space-y-2">
          {disbursements.map(d => {
            const cfg = DISBURSEMENT_STATUS_CONFIG[d.status]
            const isOverdue = d.expected_date && d.status === 'pending' && new Date(d.expected_date) < new Date()
            return (
              <div key={d.id} className={`border rounded-xl p-4 ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-900">Tranche {d.tranche_number}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {isOverdue && <span className="text-xs text-red-600 font-medium">Overdue</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      Expected: {fmt(d.expected_amount)}{d.expected_date && ` by ${d.expected_date}`}
                      {d.milestone?.name && ` · Milestone: ${d.milestone.name}`}
                    </p>
                    {d.actual_amount && (
                      <p className="text-xs text-green-600">Received: {fmt(d.actual_amount)} on {d.actual_date}</p>
                    )}
                    {d.bank_reference && <p className="text-xs text-slate-400">Ref: {d.bank_reference}</p>}
                  </div>
                  {d.status !== 'received' && (
                    <button onClick={() => setShowMarkForm(d.id)}
                      className="text-xs text-indigo-600 hover:underline shrink-0">
                      Mark received
                    </button>
                  )}
                </div>

                {showMarkForm === d.id && (
                  <form onSubmit={e => { e.preventDefault(); handleMark(d.id, 'received', new FormData(e.currentTarget)) }}
                    className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Actual Amount (₹)</label>
                      <input type="number" name="actual_amount" defaultValue={d.expected_amount} required
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Date Received</label>
                      <input type="date" name="actual_date" defaultValue={new Date().toISOString().split('T')[0]} required
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Bank Ref / UTR</label>
                      <input name="bank_reference" placeholder="UTR123..."
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="col-span-3 flex gap-2">
                      <button type="submit" disabled={markingId === d.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                        <CheckCircle2 size={11} /> Confirm Receipt
                      </button>
                      <button type="button" onClick={() => setShowMarkForm(null)}
                        className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs rounded-lg">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
          <Plus size={12} /> Add Tranche
        </button>
      ) : (
        <form onSubmit={handleAddTranche} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">New Disbursement Tranche</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Expected Amount (₹) <span className="text-red-500">*</span></label>
              <input type="number" name="expected_amount" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Expected Date</label>
              <input type="date" name="expected_date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Linked Milestone</label>
              <select name="milestone_id"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {addLoading ? 'Adding...' : 'Add Tranche'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
