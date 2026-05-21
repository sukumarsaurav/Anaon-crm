export const dynamic = 'force-dynamic'

import { getBankTieups } from '@/lib/loans/queries'
import { BankTieupFormButton, BankToggleButton } from '@/components/loans/BankTieupForm'
import { Building2, Phone, Mail, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'

export default async function BanksPage() {
  const banks = await getBankTieups()
  const active = banks.filter(b => b.is_active)
  const inactive = banks.filter(b => !b.is_active)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Bank / NBFC Tie-ups"
        subtitle={`${active.length} active tie-ups`}
        actions={<BankTieupFormButton />}
      />

      {banks.length === 0 ? (
        <EmptyState
          bordered
          icon={<Building2 size={40} />}
          title="No bank tie-ups yet"
          description="Add approved banks and NBFCs for home loan referrals"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {active.map(bank => (
              <BankCard key={bank.id} bank={bank} />
            ))}
          </div>
          {inactive.length > 0 && (
            <details className="bg-slate-50 rounded-xl">
              <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer">
                Inactive ({inactive.length})
              </summary>
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inactive.map(bank => (
                  <BankCard key={bank.id} bank={bank} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function BankCard({ bank }: { bank: any }) {
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${bank.is_active ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-900">{bank.bank_name}</p>
          <p className="text-xs text-slate-500">{bank.loan_product_name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BankTieupFormButton bank={bank} />
          <BankToggleButton id={bank.id} isActive={bank.is_active} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
        {bank.max_loan_pct && (
          <div><span className="text-slate-500">Max Loan</span> <span className="font-medium text-slate-700">{bank.max_loan_pct}%</span></div>
        )}
        {bank.interest_rate && (
          <div><span className="text-slate-500">Rate</span> <span className="font-medium text-slate-700">{bank.interest_rate}% {bank.interest_type}</span></div>
        )}
        {bank.processing_fee && (
          <div><span className="text-slate-500">Processing</span> <span className="font-medium text-slate-700">{formatCurrency(bank.processing_fee, { mode: 'exact' })}</span></div>
        )}
        {bank.turnaround_days && (
          <div className="flex items-center gap-1"><Clock size={14} className="text-slate-400" /><span className="font-medium text-slate-700">{bank.turnaround_days}d TAT</span></div>
        )}
      </div>

      {(bank.rm_name || bank.rm_phone) && (
        <div className="pt-3 border-t border-slate-100 text-xs text-slate-700 space-y-1">
          {bank.rm_name && <p className="font-medium">{bank.rm_name}</p>}
          <div className="flex items-center gap-3">
            {bank.rm_phone && (
              <a href={`tel:${bank.rm_phone}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                <Phone size={14} /> {bank.rm_phone}
              </a>
            )}
            {bank.rm_email && (
              <a href={`mailto:${bank.rm_email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                <Mail size={14} /> {bank.rm_email}
              </a>
            )}
          </div>
        </div>
      )}

      {bank.notes && <p className="text-xs text-slate-500 mt-2 italic">{bank.notes}</p>}
    </div>
  )
}
