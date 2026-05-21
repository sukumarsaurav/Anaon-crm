export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { getCollectionReport, getOutstandingReport, getBrokerCommissions } from '@/lib/reports/queries'
import DateRangeFilter from '@/components/reports/DateRangeFilter'
import ExportButton from '@/components/reports/ExportButton'
import { formatDate, formatCurrency } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function FinancialReportsPage({ searchParams }: PageProps) {
  const { from, to } = await searchParams
  const [collections, outstanding, brokerData] = await Promise.all([
    getCollectionReport(from, to),
    getOutstandingReport(),
    getBrokerCommissions(from, to),
  ])

  const fmtL = (v: number) => formatCurrency(v, { precision: 2 })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Financial Reports</h1>
        </div>
        <DateRangeFilter />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Collections', value: fmtL(collections.total), color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Outstanding', value: fmtL(outstanding.total), color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Overdue', value: fmtL(outstanding.overdue), color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Commission Due', value: fmtL(brokerData.due), color: 'text-indigo-700', bg: 'bg-indigo-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-slate-200 rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Collections */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Collection Report ({collections.payments.length})</h2>
          <ExportButton reportType="collections" from={from} to={to} label="CSV" />
        </div>
        {collections.payments.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No payments collected in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">Mode</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collections.payments.slice(0, 100).map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(p.paid_date)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{p.client?.full_name}</p>
                      <p className="text-xs text-slate-400">{p.booking?.booking_number}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{p.booking?.project?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 capitalize">{p.mode ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                      {fmtL(Number(p.amount_paid ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmtL(collections.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Outstanding */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Outstanding Payments ({outstanding.payments.length})</h2>
          <ExportButton reportType="outstanding" label="CSV" />
        </div>
        {outstanding.payments.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No outstanding payments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Amount Due</th>
                  <th className="px-4 py-2.5 text-right">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outstanding.payments.slice(0, 100).map((p: any) => (
                  <tr key={p.id} className={p.daysOverdue > 0 ? 'bg-red-50/30' : ''}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{p.client?.full_name}</p>
                      <p className="text-xs text-slate-400">{p.client?.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{p.booking?.project?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(p.due_date)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {fmtL(Number(p.amount_due ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.daysOverdue > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-red-600 font-medium">
                          <AlertTriangle size={12} />
                          {p.daysOverdue}d
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Broker Commissions */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Broker Commissions</h2>
          <ExportButton reportType="broker_commissions" from={from} to={to} label="CSV" />
        </div>
        {brokerData.commissions.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No broker commissions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Broker</th>
                  <th className="px-4 py-2.5 text-left">Booking</th>
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(brokerData.commissions as any[]).map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{c.broker?.name}</p>
                      <p className="text-xs text-slate-400">{c.broker?.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{c.booking?.booking_number}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.booking?.project?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtL(Number(c.amount ?? 0))}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td colSpan={3} className="px-4 py-3 text-xs text-slate-500">
                    Due: {fmtL(brokerData.due)} · Paid: {fmtL(brokerData.paid)}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-slate-900">
                    {fmtL(brokerData.due + brokerData.paid)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
