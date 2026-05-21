export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { getAdvisorScorecard, getBookingReport, getSiteVisitReport } from '@/lib/reports/queries'
import DateRangeFilter from '@/components/reports/DateRangeFilter'
import ExportButton from '@/components/reports/ExportButton'
import { formatDate, formatCurrency } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function SalesReportsPage({ searchParams }: PageProps) {
  const { from, to } = await searchParams
  const [scorecard, bookings, visits] = await Promise.all([
    getAdvisorScorecard(from, to),
    getBookingReport(from, to),
    getSiteVisitReport(from, to),
  ])

  const totalRevenue = bookings.reduce((s: number, b: any) => s + Number(b.total_sale_value ?? 0), 0)
  const fmtCrore = (v: number) => formatCurrency(v, { precision: 2 })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sales Reports</h1>
            <p className="text-sm text-slate-500">
              {bookings.length} bookings · {visits.length} site visits · {fmtCrore(totalRevenue)} revenue
              {(from || to) && ` · Filtered`}
            </p>
          </div>
        </div>
        <DateRangeFilter />
      </div>

      {/* Advisor Scorecard */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Advisor Scorecard</h2>
          <ExportButton reportType="advisor_scorecard" from={from} to={to} label="CSV" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-4 py-2.5 text-left">Advisor</th>
                <th className="px-4 py-2.5 text-right">Leads</th>
                <th className="px-4 py-2.5 text-right">Calls</th>
                <th className="px-4 py-2.5 text-right">Follow-ups</th>
                <th className="px-4 py-2.5 text-right">Visits</th>
                <th className="px-4 py-2.5 text-right">Bookings</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
                <th className="px-4 py-2.5 text-right">vs Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scorecard.map(a => {
                const bookingPct = a.targetBookings > 0 ? Math.round((a.bookings / a.targetBookings) * 100) : null
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.name}</p>
                      {a.designation && <p className="text-xs text-slate-400">{a.designation}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{a.leads}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{a.calls}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{a.followUps}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{a.visits}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{a.bookings}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtCrore(a.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      {bookingPct !== null ? (
                        <span className={`flex items-center justify-end gap-1 font-medium ${
                          bookingPct >= 100 ? 'text-green-600' : bookingPct >= 70 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {bookingPct >= 100 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {bookingPct}%
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Report */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Booking Report ({bookings.length})</h2>
          <ExportButton reportType="bookings" from={from} to={to} label="CSV" />
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No bookings in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Booking #</th>
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">Plot</th>
                  <th className="px-4 py-2.5 text-left">Advisor</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.slice(0, 50).map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(b.booking_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{b.booking_number}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{b.client?.full_name}</p>
                      <p className="text-xs text-slate-400">{b.client?.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{b.project?.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{b.plot?.plot_number ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{b.advisor?.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {fmtCrore(Number(b.total_sale_value ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-slate-600">Total {bookings.length} bookings</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{fmtCrore(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Site Visit Report */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Site Visit Report ({visits.length})</h2>
        </div>
        {visits.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No site visits in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Lead</th>
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">Advisor</th>
                  <th className="px-4 py-2.5 text-left">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.slice(0, 50).map((v: any) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(v.visited_at ?? v.scheduled_at)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{v.lead?.full_name}</p>
                      <p className="text-xs text-slate-400">{v.lead?.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{v.project?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{v.advisor?.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        v.status === 'completed' ? 'bg-green-50 text-green-700' :
                        v.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>{v.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
