export const dynamic = 'force-dynamic'

import { getDSAs } from '@/lib/loans/queries'
import { DSAFormButton, DSAToggleButton } from '@/components/loans/DSAForm'
import { Users2, Phone, Mail } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'

export default async function DSAsPage() {
  const dsas = await getDSAs()
  const active = dsas.filter(d => d.is_active)
  const inactive = dsas.filter(d => !d.is_active)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="DSA / Loan Agents"
        subtitle={`${active.length} active agents`}
        actions={<DSAFormButton />}
      />

      {dsas.length === 0 ? (
        <EmptyState
          bordered
          icon={<Users2 size={40} />}
          title="No DSAs yet"
          description="Add Direct Selling Agents who facilitate home loans for clients"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {active.map(dsa => <DSACard key={dsa.id} dsa={dsa} />)}
          </div>
          {inactive.length > 0 && (
            <details className="bg-slate-50 rounded-xl">
              <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer">
                Inactive ({inactive.length})
              </summary>
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inactive.map(dsa => <DSACard key={dsa.id} dsa={dsa} />)}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function DSACard({ dsa }: { dsa: any }) {
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${dsa.is_active ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-900">{dsa.name}</p>
          {dsa.firm_name && <p className="text-xs text-slate-500">{dsa.firm_name}</p>}
          {dsa.city && <p className="text-xs text-slate-400">{dsa.city}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DSAFormButton dsa={dsa} />
          <DSAToggleButton id={dsa.id} isActive={dsa.is_active} />
        </div>
      </div>

      {dsa.bank_empanelments?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {dsa.bank_empanelments.map((b: string) => (
            <span key={b} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{b}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs">
        {dsa.contact_phone && (
          <a href={`tel:${dsa.contact_phone}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
            <Phone size={14} /> {dsa.contact_phone}
          </a>
        )}
        {dsa.contact_email && (
          <a href={`mailto:${dsa.contact_email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
            <Mail size={14} /> {dsa.contact_email}
          </a>
        )}
      </div>

      {dsa.commission_rate && (
        <p className="text-xs text-slate-500 mt-2">Commission: {dsa.commission_rate}% of loan amount</p>
      )}
      {dsa.notes && <p className="text-xs text-slate-500 mt-1 italic">{dsa.notes}</p>}
    </div>
  )
}
