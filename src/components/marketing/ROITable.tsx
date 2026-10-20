import { formatCurrency } from '@/lib/utils'
import type { SourceROI } from '@/types/marketing'
import { sourceLabel, sourceStyle } from '@/types/marketing'

interface Props {
  rows: SourceROI[]
}

export default function ROITable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No lead or spend data for this period.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-slate-50 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <th scope="col" className="px-4 py-3 text-left">Source</th>
            <th scope="col" className="px-4 py-3 text-right">Leads</th>
            <th scope="col" className="px-4 py-3 text-right">Site Visits</th>
            <th scope="col" className="px-4 py-3 text-right">Bookings</th>
            <th scope="col" className="px-4 py-3 text-right">Revenue</th>
            <th scope="col" className="px-4 py-3 text-right">Ad Spend</th>
            <th scope="col" className="px-4 py-3 text-right">CPL</th>
            <th scope="col" className="px-4 py-3 text-right">ROAS</th>
            <th scope="col" className="px-4 py-3 text-right">Lead→Visit</th>
            <th scope="col" className="px-4 py-3 text-right">Visit→Booking</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const style = sourceStyle(row.source)
            return (
              <tr key={row.source} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.color}`}>
                    {sourceLabel(row.source)}
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
                <td className="px-4 py-3 text-right text-slate-700">{row.leads_count > 0 ? `${row.lead_to_visit_rate}%` : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-700">{row.site_visits_count > 0 ? `${row.visit_to_booking_rate}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
