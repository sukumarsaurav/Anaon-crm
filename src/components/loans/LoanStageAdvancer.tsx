'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLoanStage } from '@/lib/loans/actions'
import type { LoanStage, LoanApplication, BankTieup, DSA } from '@/types/loans'
import { LOAN_STAGES } from '@/types/loans'
import { ChevronRight } from 'lucide-react'

interface Props {
  loan: LoanApplication
  banks: BankTieup[]
  dsas: DSA[]
}

const STAGE_ORDER: LoanStage[] = [
  'eligibility_check', 'bank_selected', 'application_submitted',
  'docs_submitted', 'sanction_received', 'disbursement',
]

function nextStage(current: LoanStage): LoanStage | null {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

export default function LoanStageAdvancer({ loan, banks, dsas }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [targetStage, setTargetStage] = useState<LoanStage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const next = nextStage(loan.stage)
  const isRejected = loan.stage === 'rejected'

  function openAdvance(stage: LoanStage) {
    setTargetStage(stage)
    setShowForm(true)
    setError(null)
  }

  function openReject() {
    setTargetStage('rejected')
    setShowForm(true)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!targetStage) return
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateLoanStage(loan.id, targetStage, fd)
      setLoading(false)
      if (result.success) { setShowForm(false); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  if (isRejected) return null

  return (
    <div className="space-y-3">
      {!showForm ? (
        <div className="flex flex-wrap gap-2">
          {next && (
            <button onClick={() => openAdvance(next)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Advance to {LOAN_STAGES.find(s => s.value === next)?.label}
              <ChevronRight size={14} />
            </button>
          )}
          <button onClick={openReject}
            className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50">
            Mark Rejected
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            {targetStage === 'rejected' ? 'Rejection Details' : `Advancing to: ${LOAN_STAGES.find(s => s.value === targetStage)?.label}`}
          </p>

          {/* Bank Selected */}
          {targetStage === 'bank_selected' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bank</label>
                <select name="bank_tieup_id" defaultValue={loan.bank_tieup_id ?? ''}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select bank</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.loan_product_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">DSA (optional)</label>
                <select name="dsa_id" defaultValue={loan.dsa_id ?? ''}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Direct / no DSA</option>
                  {dsas.map(d => <option key={d.id} value={d.id}>{d.name}{d.firm_name ? ` (${d.firm_name})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">RM Contacted Date</label>
                <input type="date" name="rm_contacted_date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          {/* Application Submitted */}
          {targetStage === 'application_submitted' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Loan Amount Applied (₹)</label>
                <input type="number" name="loan_amount_applied" defaultValue={loan.loan_amount_applied ?? ''}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Application Date</label>
                <input type="date" name="application_date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Processing Fee Paid (₹)</label>
                <input type="number" name="processing_fee_paid"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          {/* Sanction */}
          {targetStage === 'sanction_received' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sanctioned Amount (₹) <span className="text-red-500">*</span></label>
                <input type="number" name="sanctioned_amount" required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Interest Rate (%)</label>
                <input type="number" step="0.01" name="sanctioned_interest_rate"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tenure (months)</label>
                <input type="number" name="sanctioned_tenure_months"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sanction Date</label>
                <input type="date" name="sanction_date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          {/* Rejected */}
          {targetStage === 'rejected' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rejection Date</label>
                <input type="date" name="rejection_date" defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Alternate Bank Tried</label>
                <input name="alternate_bank_tried" placeholder="Bank name..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Rejection Reason</label>
                <textarea name="rejection_reason" rows={2} placeholder="Low CIBIL score / insufficient income..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className={`px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${
                targetStage === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}>
              {loading ? 'Saving...' : 'Confirm'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
