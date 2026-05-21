export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLoanApplicationById } from '@/lib/loans/queries'
import { getBankTieups, getDSAs } from '@/lib/loans/queries'
import { createClient } from '@/lib/supabase/server'
import { LOAN_STAGES, LOAN_DOC_CHECKLIST } from '@/types/loans'
import LoanStageAdvancer from '@/components/loans/LoanStageAdvancer'
import DisbursementManager from '@/components/loans/DisbursementManager'
import { ChevronLeft, CheckCircle2, XCircle, Phone, Building2, Users2 } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

interface Props { params: Promise<{ loanId: string }> }

const fmt = (n: number | null) => formatCurrency(n, { precision: 2 })

export default async function LoanDetailPage({ params }: Props) {
  const { loanId } = await params

  const supabase = await createClient()
  const [loan, banks, dsas, milestonesRes] = await Promise.all([
    getLoanApplicationById(loanId),
    getBankTieups(true),
    getDSAs(true),
    supabase.from('construction_milestones').select('id, name').eq('status', 'pending').order('sequence_order'),
  ])

  if (!loan) notFound()

  const currentStageIdx = LOAN_STAGES.findIndex(s => s.value === loan.stage)
  const activeStages = LOAN_STAGES.filter(s => s.step > 0)
  const docsDone = LOAN_DOC_CHECKLIST.filter(d => loan[d.key]).length

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/loans" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {(loan as any).client?.full_name ?? 'Loan Application'}
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              {(loan as any).client?.phone && (
                <a href={`tel:${(loan as any).client.phone}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                  <Phone size={11} /> {(loan as any).client.phone}
                </a>
              )}
              <Link href={`/clients/${loan.client_id}`} className="text-xs text-slate-400 hover:text-indigo-600">View Client →</Link>
            </div>
          </div>
        </div>
        {loan.stage !== 'rejected' && (
          (() => {
            const stg = LOAN_STAGES.find(s => s.value === loan.stage)
            return stg ? (
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${stg.bg} ${stg.color}`}>{stg.label}</span>
            ) : null
          })()
        )}
      </div>

      {/* Stage progress bar */}
      {loan.stage !== 'rejected' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-0">
            {activeStages.map((s, i) => {
              const done = currentStageIdx >= LOAN_STAGES.findIndex(ls => ls.value === s.value)
              return (
                <div key={s.value} className="flex items-center flex-1">
                  <div className={`flex flex-col items-center ${i < activeStages.length - 1 ? 'flex-1' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      done ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-400'
                    }`}>{s.step}</div>
                    <p className={`text-xs mt-1 text-center leading-tight w-16 ${done ? 'text-indigo-700 font-medium' : 'text-slate-400'}`}>
                      {s.label}
                    </p>
                  </div>
                  {i < activeStages.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-5 ${done ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rejected banner */}
      {loan.stage === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-semibold text-red-700 text-sm mb-1">Application Rejected</p>
          {loan.rejection_reason && <p className="text-xs text-red-600">{loan.rejection_reason}</p>}
          {loan.alternate_bank_tried && <p className="text-xs text-red-500 mt-1">Tried alternate: {loan.alternate_bank_tried}</p>}
          {loan.rejection_date && <p className="text-xs text-red-400 mt-1">{loan.rejection_date}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — details */}
        <div className="lg:col-span-3 space-y-6">

          {/* Stage action */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Next Action</h2>
            <LoanStageAdvancer loan={loan} banks={banks} dsas={dsas} />
          </div>

          {/* Key details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Loan Details</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Detail label="Bank" value={(loan as any).bank?.bank_name ?? 'Not selected'} />
              <Detail label="Product" value={(loan as any).bank?.loan_product_name} />
              <Detail label="DSA" value={(loan as any).dsa?.name} />
              <Detail label="Income/month" value={fmt(loan.monthly_income)} />
              <Detail label="Existing EMIs" value={fmt(loan.existing_emis)} />
              <Detail label="CIBIL Score" value={loan.credit_score?.toString()} />
              <Detail label="Loan Applied" value={fmt(loan.loan_amount_applied)} />
              <Detail label="Application Date" value={loan.application_date} />
              {loan.sanctioned_amount && <>
                <Detail label="Sanctioned" value={fmt(loan.sanctioned_amount)} />
                <Detail label="Rate" value={loan.sanctioned_interest_rate ? `${loan.sanctioned_interest_rate}%` : undefined} />
                <Detail label="Tenure" value={loan.sanctioned_tenure_months ? `${loan.sanctioned_tenure_months} months` : undefined} />
                <Detail label="Sanction Date" value={loan.sanction_date} />
              </>}
              {(loan as any).bank?.rm_name && <Detail label="Bank RM" value={`${(loan as any).bank.rm_name}${(loan as any).bank.rm_phone ? ` · ${(loan as any).bank.rm_phone}` : ''}`} />}
            </div>
          </div>

          {/* Document checklist */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Document Checklist</h2>
              <span className="text-xs text-slate-500">{docsDone}/{LOAN_DOC_CHECKLIST.length} submitted</span>
            </div>
            <div className="space-y-2">
              {LOAN_DOC_CHECKLIST.map(doc => {
                const done = loan[doc.key] as boolean
                return (
                  <div key={doc.key} className="flex items-center gap-3">
                    {done
                      ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                      : <XCircle size={15} className="text-slate-300 shrink-0" />}
                    <span className={`text-sm ${done ? 'text-slate-700' : 'text-slate-400'}`}>{doc.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-slate-400 mt-3">Update docs from the edit page or through the stage advancer</p>
          </div>
        </div>

        {/* Right — disbursements + bank info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Sanction summary */}
          {loan.sanctioned_amount && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-medium text-green-700 mb-1">Sanction Summary</p>
              <p className="text-2xl font-bold text-green-900">{fmt(loan.sanctioned_amount)}</p>
              <p className="text-xs text-green-700 mt-0.5">
                {loan.sanctioned_interest_rate}% p.a. · {loan.sanctioned_tenure_months} months
              </p>
              {loan.sanction_date && <p className="text-xs text-green-600 mt-1">Sanctioned {loan.sanction_date}</p>}
            </div>
          )}

          {/* Disbursements */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Disbursement Schedule</h2>
            <DisbursementManager
              loanId={loan.id}
              disbursements={(loan.disbursements ?? []) as any}
              milestones={milestonesRes.data ?? []}
            />
          </div>

          {/* Bank RM details */}
          {(loan as any).bank && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={14} className="text-slate-400" />
                <p className="font-medium text-slate-700">{(loan as any).bank.bank_name}</p>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                {(loan as any).bank.rm_name && <p>RM: {(loan as any).bank.rm_name}</p>}
                {(loan as any).bank.rm_phone && <a href={`tel:${(loan as any).bank.rm_phone}`} className="flex items-center gap-1 text-indigo-600 hover:underline"><Phone size={10} />{(loan as any).bank.rm_phone}</a>}
                {(loan as any).bank.turnaround_days && <p>TAT: {(loan as any).bank.turnaround_days} days</p>}
                {(loan as any).bank.max_loan_pct && <p>Max: {(loan as any).bank.max_loan_pct}% of value</p>}
              </div>
            </div>
          )}

          {/* DSA */}
          {(loan as any).dsa && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users2 size={14} className="text-slate-400" />
                <p className="font-medium text-slate-700">{(loan as any).dsa.name}</p>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                {(loan as any).dsa.firm_name && <p>{(loan as any).dsa.firm_name}</p>}
                {(loan as any).dsa.contact_phone && <a href={`tel:${(loan as any).dsa.contact_phone}`} className="flex items-center gap-1 text-indigo-600 hover:underline"><Phone size={10} />{(loan as any).dsa.contact_phone}</a>}
              </div>
            </div>
          )}

          {/* Notes */}
          {loan.notes && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{loan.notes}</p>
            </div>
          )}
          <p className="text-xs text-slate-400">Created {formatDate(loan.created_at)} · Updated {formatDate(loan.updated_at)}</p>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  )
}
