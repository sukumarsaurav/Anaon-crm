export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react'
import { getInventoryAvailability, getPlotAgeing, getSoftHoldReport } from '@/lib/reports/queries'
import ExportButton from '@/components/reports/ExportButton'
import { formatDate } from '@/lib/utils'

export default async function InventoryReportsPage() {
  const [availability, plotAgeing, softHolds] = await Promise.all([
    getInventoryAvailability(),
    getPlotAgeing(),
    getSoftHoldReport(),
  ])

  const totals = availability.reduce(
    (acc, p) => ({ total: acc.total + p.total, available: acc.available + p.available, held: acc.held + p.held, booked: acc.booked + p.booked, sold: acc.sold + p.sold }),
    { total: 0, available: 0, held: 0, booked: 0, sold: 0 }
  )

  const ageBuckets = {
    '0-30': plotAgeing.filter(p => p.daysAvailable <= 30).length,
    '31-60': plotAgeing.filter(p => p.daysAvailable > 30 && p.daysAvailable <= 60).length,
    '61-90': plotAgeing.filter(p => p.daysAvailable > 60 && p.daysAvailable <= 90).length,
    '90-180': plotAgeing.filter(p => p.daysAvailable > 90 && p.daysAvailable <= 180).length,
    '180+': plotAgeing.filter(p => p.daysAvailable > 180).length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Inventory Reports</h1>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: totals.total, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Available', value: totals.available, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Held', value: totals.held, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Booked', value: totals.booked, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Sold', value: totals.sold, color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Availability by project */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Availability by Project</h2>
          <ExportButton reportType="inventory" label="CSV" />
        </div>
        {availability.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No projects found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">City</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Available</th>
                  <th className="px-4 py-2.5 text-right">Held</th>
                  <th className="px-4 py-2.5 text-right">Booked</th>
                  <th className="px-4 py-2.5 text-right">Sold</th>
                  <th className="px-4 py-2.5 text-right">Sold %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {availability.map(p => {
                  const soldPct = p.total > 0 ? Math.round(((p.sold + p.booked) / p.total) * 100) : 0
                  return (
                    <tr key={p.project} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{p.project}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.city ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{p.total}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{p.available}</td>
                      <td className="px-4 py-2.5 text-right text-amber-700">{p.held}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{p.booked}</td>
                      <td className="px-4 py-2.5 text-right text-purple-700">{p.sold}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${soldPct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{soldPct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plot Ageing */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 text-sm">Plot Ageing — Available Plots by Age</h2>
          <ExportButton reportType="plot_ageing" label="CSV" />
        </div>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {Object.entries(ageBuckets).map(([range, count]) => (
            <div key={range} className={`rounded-xl p-4 text-center ${
              range === '180+' ? 'bg-red-50' : range === '90-180' ? 'bg-orange-50' :
              range === '61-90' ? 'bg-amber-50' : 'bg-slate-50'
            }`}>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{range}d</p>
            </div>
          ))}
        </div>
        {plotAgeing.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 text-left">Plot</th>
                  <th className="pb-2 text-left">Project</th>
                  <th className="pb-2 text-right">Days Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plotAgeing.slice(0, 30).map((p: any) => (
                  <tr key={p.id} className={p.daysAvailable > 180 ? 'bg-red-50/30' : p.daysAvailable > 90 ? 'bg-amber-50/30' : ''}>
                    <td className="py-2 font-mono text-xs text-slate-700">{p.plot_number}</td>
                    <td className="py-2 text-slate-600">{p.project?.name ?? '—'}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${p.daysAvailable > 180 ? 'text-red-600' : p.daysAvailable > 90 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {p.daysAvailable}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Soft Hold Report */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Active Soft Holds ({softHolds.length})</h2>
        </div>
        {softHolds.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No active soft holds.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {(softHolds as any[]).map(h => (
              <div key={h.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${h.isExpired ? 'bg-red-50/40' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 text-sm">Plot {h.plot?.plot_number}</p>
                    {h.isExpired && <span className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle size={11} /> Expired</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {h.project?.name} · {h.lead?.full_name ?? 'Unknown lead'} · by {h.advisor?.full_name ?? 'Unknown'}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div className="flex items-center gap-1"><Clock size={11} /> {formatDate(h.held_at)}</div>
                  <p className="text-slate-400">Expires {formatDate(h.expires_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
