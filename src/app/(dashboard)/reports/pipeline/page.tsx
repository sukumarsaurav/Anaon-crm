export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getSourcePerformance,
  getResponseTimeByRep,
  getWinLossReport,
} from '@/lib/reports/queries'
import { SOURCE_LABELS } from '@/types/leads'
import type { LeadSource } from '@/types/leads'
import DateRangeFilter from '@/components/reports/DateRangeFilter'

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

function fmtMinutes(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const sourceLabel = (s: string) => SOURCE_LABELS[s as LeadSource] ?? s

export default async function PipelineAnalyticsPage({ searchParams }: PageProps) {
  const { from, to } = await searchParams
  const [sources, responseTimes, winLoss] = await Promise.all([
    getSourcePerformance(from, to),
    getResponseTimeByRep(from, to),
    getWinLossReport(from, to),
  ])

  const maxReason = Math.max(1, ...winLoss.reasons.map((r) => r.count))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Pipeline Analytics</h1>
        </div>
        <DateRangeFilter />
      </div>

      {/* Win / Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Win Rate</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{winLoss.winRate}%</p>
          <p className="text-xs text-slate-500 mt-1">
            <span className="text-green-700 font-medium">{winLoss.wins} won</span> ·{' '}
            <span className="text-red-700 font-medium">{winLoss.losses} lost</span>
          </p>
          <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${winLoss.winRate}%` }} />
          </div>
        </div>

        {/* Loss reasons */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Why Leads Are Lost</h2>
          {winLoss.reasons.length === 0 ? (
            <p className="text-sm text-slate-400">No lost leads in this period.</p>
          ) : (
            <div className="space-y-2">
              {winLoss.reasons.map((r) => (
                <div key={r.reason} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-40 shrink-0 truncate">{r.reason}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-red-400" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-8 text-right shrink-0">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Source conversion */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Source Conversion</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-2.5 text-left">Source</th>
                <th className="px-5 py-2.5 text-right">Leads</th>
                <th className="px-5 py-2.5 text-right">Visits</th>
                <th className="px-5 py-2.5 text-right">Bookings</th>
                <th className="px-5 py-2.5 text-right">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">No data for this period.</td></tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.source} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{sourceLabel(s.source)}</td>
                    <td className="px-5 py-2.5 text-right text-slate-900 font-semibold">{s.leads}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{s.visits}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{s.bookings}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={s.conversionRate >= 10 ? 'text-green-700 font-medium' : 'text-slate-600'}>
                        {s.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Response time by rep */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">First-Response Time by Rep</h2>
          <p className="text-xs text-slate-500 mt-0.5">Avg time from lead assignment to first call/WhatsApp</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-2.5 text-left">Rep</th>
                <th className="px-5 py-2.5 text-right">Leads</th>
                <th className="px-5 py-2.5 text-right">Responded</th>
                <th className="px-5 py-2.5 text-right">Response Rate</th>
                <th className="px-5 py-2.5 text-right">Avg Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {responseTimes.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">No assigned leads for this period.</td></tr>
              ) : (
                responseTimes.map((r) => (
                  <tr key={r.advisor} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{r.advisor}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{r.totalLeads}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{r.responded}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={r.responseRate >= 80 ? 'text-green-700 font-medium' : r.responseRate >= 50 ? 'text-amber-700' : 'text-red-600'}>
                        {r.responseRate}%
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-900">{fmtMinutes(r.avgResponseMinutes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
