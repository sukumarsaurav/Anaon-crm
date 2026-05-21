import { formatCurrency } from '@/lib/utils'
import type { SourceROI } from '@/types/marketing'
import { PLATFORM_CONFIG } from '@/types/marketing'

interface Props {
  rows: SourceROI[]
}

function MetricCell({ value, suffix = '', dash = false }: { value: number | null; suffix?: string; dash?: boolean }) {
  if (value === null) return <span className="text-slate-300">—</span>
  return <span>{typeof value === 'number' && value >= 1000 ? formatCurrency(value) : value}{suffix}</span>
}

export default function ROITable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No campaign data yet. Add campaigns and UTM-tagged leads will appear here.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Source</th>
            <th className="px-4 py-3 text-right">Leads</th>
            <th className="px-4 py-3 text-right">Site Visits</th>
            <th className="px-4 py-3 text-right">Bookings</th>
            <th className="px-4 py-3 text-right">Revenue</th>
            <th className="px-4 py-3 text-right">Ad Spend</th>
            <th className="px-4 py-3 text-right">CPL</th>
            <th className="px-4 py-3 text-right">ROAS</th>
            <th className="px-4 py-3 text-right">Lead→Visit</th>
            <th className="px-4 py-3 text-right">Visit→Booking</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const platformKey = row.utm_source as keyof typeof PLATFORM_CONFIG
            const config = PLATFORM_CONFIG[platformKey] ?? PLATFORM_CONFIG.other
            return (
              <tr key={row.utm_source} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{row.leads_count}</td>
                <td className="px-4 py-3 text-right text-slate-700">{row.site_visits_count}</td>
                <td className="px-4 py-3 text-right text-slate-700">{row.bookings_count}</td>
                <td className="px-4 py-3 text-right text-slate-900 font-medium">
                  {row.revenue > 0 ? formatCurrency(row.revenue) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.spend > 0 ? formatCurrency(row.spend) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {row.cpl ? formatCurrency(row.cpl, { mode: 'exact' }) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.roas !== null ? (
                    <span className={`font-semibold ${row.roas >= 3 ? 'text-green-600' : row.roas >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.roas}x
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{row.lead_to_visit_rate}%</td>
                <td className="px-4 py-3 text-right text-slate-700">{row.visit_to_booking_rate}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
