export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getLeadFunnel, getSLACompliance, getLeadAgeing, getSourcePerformance, getLostLeadAnalysis } from '@/lib/reports/queries'
import MiniBarChart from '@/components/reports/MiniBarChart'
import DateRangeFilter from '@/components/reports/DateRangeFilter'
import ExportButton from '@/components/reports/ExportButton'
import { formatCurrency } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', interested: 'Interested',
  site_visit_scheduled: 'Visit Sched.', site_visit_done: 'Visit Done',
  negotiation: 'Negotiation', booked: 'Booked',
  not_interested: 'Not Interested', lost: 'Lost',
}

export default async function LeadReportsPage({ searchParams }: PageProps) {
  const { from, to } = await searchParams
  const [funnel, sla, ageing, sourcePerfData, lostData] = await Promise.all([
    getLeadFunnel(),
    getSLACompliance(from, to),
    getLeadAgeing(),
    getSourcePerformance(from, to),
    getLostLeadAnalysis(from, to),
  ])

  const activeFunnel = funnel.filter(f => !['not_interested', 'lost'].includes(f.stage))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Lead Reports</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter />
          <ExportButton reportType="source_performance" from={from} to={to} />
        </div>
      </div>

      {/* SLA Compliance */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-4">SLA Compliance — Contacted within 2 Hours</h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Total Leads', value: sla.total },
            { label: 'Compliant', value: sla.compliant, color: 'text-green-700' },
            { label: 'Non-Compliant', value: sla.nonCompliant, color: 'text-red-700' },
            { label: 'SLA Rate', value: `${sla.rate}%`, color: sla.rate >= 80 ? 'text-green-700' : sla.rate >= 50 ? 'text-amber-700' : 'text-red-700' },
          ].map(({ label, value, color = 'text-slate-900' }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full bg-green-500" style={{ width: `${sla.rate}%` }} />
        </div>
      </div>

      {/* Lead Funnel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-4">Lead Funnel</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="pb-3 text-left">Stage</th>
                <th className="pb-3 text-right">Count</th>
                <th className="pb-3 text-right">Share</th>
                <th className="pb-3 text-right">Drop-off</th>
                <th className="pb-3 pl-4">Visual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeFunnel.map((row) => (
                <tr key={row.stage} className={row.dropOff !== null && row.dropOff > 50 ? 'bg-red-50/30' : ''}>
                  <td className="py-2.5 font-medium text-slate-800">{STAGE_LABELS[row.stage] ?? row.stage}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">{row.count}</td>
                  <td className="py-2.5 text-right text-slate-500">{row.pct}%</td>
                  <td className="py-2.5 text-right">
                    {row.dropOff !== null
                      ? <span className={`font-medium ${row.dropOff > 50 ? 'text-red-600' : row.dropOff > 25 ? 'text-amber-600' : 'text-slate-500'}`}>
                          -{row.dropOff}%
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 pl-4 w-40">
                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${row.pct}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Ageing */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-4">Lead Ageing — Days Since Last Activity (Active Leads)</h2>
        <div className="grid grid-cols-5 gap-3">
          {ageing.map(({ range, count }) => (
            <div key={range} className={`rounded-xl p-4 text-center ${
              range === '60+' ? 'bg-red-50' : range === '31-60' ? 'bg-amber-50' : 'bg-slate-50'
            }`}>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{range} days</p>
            </div>
          ))}
        </div>
      </div>

      {/* Source Performance */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Source Performance</h2>
          <ExportButton reportType="source_performance" from={from} to={to} label="CSV" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Source</th>
                <th className="px-4 py-2.5 text-right">Leads</th>
                <th className="px-4 py-2.5 text-right">Visits</th>
                <th className="px-4 py-2.5 text-right">Bookings</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
                <th className="px-4 py-2.5 text-right">L→V%</th>
                <th className="px-4 py-2.5 text-right">V→B%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sourcePerfData.map(row => (
                <tr key={row.source} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900 capitalize">{row.source}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{row.leads}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{row.visits}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{row.bookings}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {row.revenue > 0 ? formatCurrency(row.revenue) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {row.leads > 0 ? `${Math.round((row.visits / row.leads) * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {row.visits > 0 ? `${Math.round((row.bookings / row.visits) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lost Lead Analysis */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-3">Lost Lead Analysis</h2>
        <p className="text-sm text-slate-500 mb-3">{lostData.total} leads marked lost or not interested</p>
        {lostData.sampleNotes.length > 0 ? (
          <div className="space-y-1.5">
            {lostData.sampleNotes.slice(0, 10).map((note, i) => (
              <p key={i} className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 italic">{note}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No activity notes recorded for lost leads.</p>
        )}
      </div>
    </div>
  )
}
