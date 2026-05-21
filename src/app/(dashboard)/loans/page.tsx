export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getLoanStats, getLoanApplications, getPendingDisbursements } from '@/lib/loans/queries'
import { LOAN_STAGES, DISBURSEMENT_STATUS_CONFIG } from '@/types/loans'
import { CreditCard, Building2, Users2, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'

const fmt = (n: number) => formatCurrency(n)

export default async function LoansPage() {
  const [stats, applications, pendingDisbs] = await Promise.all([
    getLoanStats(),
    getLoanApplications(),
    getPendingDisbursements(),
  ])

  const activeStages = LOAN_STAGES.filter(s => s.step > 0)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Loan & Home Finance"
        subtitle={`${stats.activeApplications} active applications · ${stats.activeBanks} banks · ${stats.activeDSAs} DSAs`}
        actions={
          <>
            <Button href="/loans/banks" variant="secondary" size="sm">
              <Building2 size={16} /> Banks
            </Button>
            <Button href="/loans/dsas" variant="secondary" size="sm">
              <Users2 size={16} /> DSAs
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Applications', value: stats.activeApplications, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Total Sanctioned', value: fmt(stats.totalSanctioned), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Disbursed', value: fmt(stats.totalDisbursed), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Disbursals', value: stats.pendingDisbursements + stats.delayedDisbursements, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} padding="sm">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Pipeline by stage */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Loan Pipeline</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {activeStages.map(s => {
            const count = stats.byStage[s.value] ?? 0
            return (
              <Link key={s.value} href={`/loans?stage=${s.value}`}
                className="text-center p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                <p className="text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
              </Link>
            )
          })}
        </div>
        {stats.byStage['rejected'] > 0 && (
          <p className="text-xs text-slate-500 mt-3">{stats.byStage['rejected']} rejected</p>
        )}
      </Card>

      {/* Pending disbursement alerts */}
      {pendingDisbs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Pending Disbursements
          </h2>
          <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pendingDisbs.map((d: any) => {
                const cfg = DISBURSEMENT_STATUS_CONFIG[d.status as keyof typeof DISBURSEMENT_STATUS_CONFIG]
                return (
                  <div key={d.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {d.loan?.client?.full_name ?? '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Tranche {d.tranche_number} · {fmt(d.expected_amount)}
                        {d.milestone?.name && ` · Milestone: ${d.milestone.name}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge config={cfg} size="sm" />
                      {d.expected_date && (
                        <p className="text-xs text-slate-500 mt-0.5">Due {d.expected_date}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* All applications */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">All Loan Applications</h2>
        {applications.length === 0 ? (
          <EmptyState
            bordered
            icon={<CreditCard size={40} />}
            title="No loan applications yet"
            description="Start tracking from the client's profile page"
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide hidden sm:table-cell">Bank</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide hidden sm:table-cell">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide hidden md:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map(app => {
                  const stage = LOAN_STAGES.find(s => s.value === app.stage)
                  const amount = app.sanctioned_amount ?? app.loan_amount_applied
                  return (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/loans/${app.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                          {(app as any).client?.full_name ?? '—'}
                        </Link>
                        <p className="text-xs text-slate-500">{(app as any).client?.phone}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-slate-700">
                        {(app as any).bank?.bank_name ?? <span className="text-slate-400">Not selected</span>}
                      </td>
                      <td className="px-4 py-3">
                        {stage && <StatusBadge config={stage} size="sm" />}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-slate-700">
                        {amount ? fmt(amount) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                        {formatDate(app.updated_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
