import { notFound } from 'next/navigation'
import { istMonthYear } from '@/lib/datetime'
import { getProfile } from '@/lib/supabase/getProfile'
import { getMemberProfile, getMonthlyKPI, getMonthlyTarget } from '@/lib/team/queries'
import { formatCurrency } from '@/lib/utils'
import KPIGrid from '@/components/team/KPIGrid'
import TargetProgressPanel from '@/components/team/TargetProgressPanel'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'Performance' }

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function MemberPerformancePage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const user = (await getProfile())?.user
  const currentProfile = (await getProfile())?.profile

  const isOwn = user!.id === id
  const canView = isOwn || currentProfile?.role === 'admin' || currentProfile?.role === 'manager'
  if (!canView) notFound()

  const current = istMonthYear()
  const m = parseInt(sp.month ?? '', 10), y = parseInt(sp.year ?? '', 10)
  const month = m >= 1 && m <= 12 ? m : current.month
  const year  = y >= 2020 && y <= 2100 ? y : current.year

  // Last 6 months for the history chart
  const monthsHistory = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - i, 1)
    return { month: d.getMonth() + 1, year: d.getFullYear() }
  }).reverse()

  const [member, ...historyData] = await Promise.all([
    getMemberProfile(id),
    ...monthsHistory.map((m) =>
      Promise.all([getMonthlyKPI(id, m.month, m.year), getMonthlyTarget(id, m.month, m.year)])
    ),
  ])

  if (!member) notFound()

  const currentKPI = historyData[historyData.length - 1]?.[0]!
  const currentTarget = historyData[historyData.length - 1]?.[1] ?? null

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref={`/team/${id}`}
        title={`${member.full_name} — Performance`}
        subtitle={new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        actions={
          <form method="GET" className="flex items-center gap-2">
            <select aria-label="Month"
              name="month"
              defaultValue={month}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2025, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <input aria-label="Year"
              name="year"
              type="number"
              defaultValue={year}
              className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            />
            <Button type="submit" variant="secondary" size="sm">Go</Button>
          </form>
        }
      />

      {/* Current month KPIs */}
      <KPIGrid kpi={currentKPI} label={`${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} KPIs`} />

      {/* Target progress */}
      <TargetProgressPanel target={currentTarget} kpi={currentKPI} />

      {/* 6-month history table */}
      <Card padding="md">
        <h3 className="font-semibold text-slate-900 mb-4">6-Month History</h3>
        <div className="overflow-x-auto [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-slate-50 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="pb-2 font-medium">Month</th>
                <th scope="col" className="pb-2 font-medium text-right">Calls</th>
                <th scope="col" className="pb-2 font-medium text-right">F/ups</th>
                <th scope="col" className="pb-2 font-medium text-right">Visits</th>
                <th scope="col" className="pb-2 font-medium text-right">Bookings</th>
                <th scope="col" className="pb-2 font-medium text-right">Revenue</th>
                <th scope="col" className="pb-2 font-medium text-right">Target %</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map(([kpi, tgt], i) => {
                const m = monthsHistory[i]
                const label = new Date(m.year, m.month - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
                const pct = tgt && tgt.target_revenue > 0
                  ? Math.round((kpi.revenue_generated / tgt.target_revenue) * 100)
                  : null
                const isCurrentMonth = m.month === month && m.year === year
                return (
                  <tr key={i} className={`border-b border-slate-100 ${isCurrentMonth ? 'bg-primary-50 font-semibold' : ''}`}>
                    <td className="py-2">{label}</td>
                    <td className="py-2 text-right">{kpi.calls_made}</td>
                    <td className="py-2 text-right">{kpi.followups_completed}</td>
                    <td className="py-2 text-right">{kpi.site_visits_completed}</td>
                    <td className="py-2 text-right">{kpi.bookings_done}</td>
                    <td className="py-2 text-right">{formatCurrency(kpi.revenue_generated)}</td>
                    <td className="py-2 text-right">
                      {pct !== null ? (
                        <span className={pct >= 100 ? 'text-green-600' : pct < 50 ? 'text-red-600' : 'text-amber-600'}>
                          {pct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
