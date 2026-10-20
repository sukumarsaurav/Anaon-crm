export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMarketingCampaigns, getSourceROI, getCampaignROI, getMarketingStats } from '@/lib/marketing/queries'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { PLATFORM_CONFIG } from '@/types/marketing'
import { formatDate, formatCurrency } from '@/lib/utils'
import { todayIST } from '@/lib/datetime'
import CampaignForm from '@/components/marketing/CampaignForm'
import ActionButton from '@/components/ui/ActionButton'
import { deleteCampaign } from '@/lib/marketing/actions'
import CampaignStatusToggle from '@/components/marketing/CampaignStatusToggle'
import SpendLogForm from '@/components/marketing/SpendLogForm'
import SpendHistory from '@/components/marketing/SpendHistory'
import ROITable from '@/components/marketing/ROITable'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { TrendingUp, Target, Users, IndianRupee, Megaphone, MousePointerClick } from 'lucide-react'

export const metadata = { title: 'Marketing ROI' }

const DATE = /^\d{4}-\d{2}-\d{2}$/

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MarketingPage({ searchParams }: Props) {
  // Spend, revenue and ROAS are manager information; the sidebar hid the link but the page
  // itself was open to every staff role.
  const role = (await getProfile())?.profile?.role
  if (role !== 'admin' && role !== 'manager') notFound()

  const params = await searchParams
  const pick = (k: string) => (typeof params[k] === 'string' && DATE.test(params[k] as string) ? (params[k] as string) : undefined)
  let from = pick('from')
  let to = pick('to')
  if (from && to && from > to) [from, to] = [to, from]
  const range = { from, to }
  const filtered = Boolean(from || to)

  const today = todayIST()
  const presets = [
    { label: 'Last 7 days', from: shiftDays(today, -6), to: today },
    { label: 'Last 30 days', from: shiftDays(today, -29), to: today },
    { label: 'This month', from: `${today.slice(0, 7)}-01`, to: today },
    { label: 'Last 90 days', from: shiftDays(today, -89), to: today },
  ]

  const supabase = await createClient()
  const [campaigns, sourceROI, campaignROI, stats, projectsRes] = await Promise.all([
    getMarketingCampaigns(),
    getSourceROI(range),
    getCampaignROI(range),
    getMarketingStats(range),
    supabase.from('projects').select('id, name').order('name'),
  ])
  const projects = projectsRes.data ?? []
  const periodLabel = filtered
    ? `${from ? formatDate(from) : 'start'} – ${to ? formatDate(to) : 'today'}`
    : 'All time'

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Marketing ROI"
        subtitle={
          <>
            {periodLabel} · {stats.activeCampaigns} active campaigns · {formatCurrency(stats.totalSpend)} spend · {formatCurrency(stats.totalRevenue)} paid revenue
            {stats.overallROAS !== null && <span className="ml-2 font-medium text-primary-600">{stats.overallROAS}x ROAS</span>}
          </>
        }
      />

      {/* Period */}
      <form method="get" className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div>
          <label htmlFor="marketing-from" className="block text-xs text-slate-500 mb-1">From</label>
          <input id="marketing-from" name="from" type="date" defaultValue={from} max={today}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="marketing-to" className="block text-xs text-slate-500 mb-1">To</label>
          <input id="marketing-to" name="to" type="date" defaultValue={to} max={today}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">Apply</button>
        <div className="flex flex-wrap gap-2 text-xs">
          {presets.map((p) => (
            <Link key={p.label} href={`/marketing?from=${p.from}&to=${p.to}`}
              className={`px-2.5 py-1 rounded-full border ${from === p.from && to === p.to ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {p.label}
            </Link>
          ))}
          {filtered && (
            <Link href="/marketing" className="px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">All time</Link>
          )}
        </div>
      </form>

      {/* Stats — all on the paid basis (campaign-attributed or paid-platform leads) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Active Campaigns', value: stats.activeCampaigns, icon: Megaphone, color: 'text-primary-600', bg: 'bg-primary-50' },
          { label: 'Paid Leads', value: stats.paidLeads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Paid Leads Visited', value: stats.paidSiteVisits, icon: MousePointerClick, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Paid Bookings', value: stats.totalBookings, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Ad Spend', value: formatCurrency(stats.totalSpend), icon: IndianRupee, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'ROAS', value: stats.overallROAS !== null ? `${stats.overallROAS}x` : '—', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
      <p className="text-xs text-slate-400 -mt-3">
        Site visits = leads with at least one completed visit. Leads by creation date, visits by visit date, bookings by booking date, spend by log date.
      </p>

      {/* Source ROI Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">ROI by Source</h2>
        </div>
        <ROITable rows={sourceROI} />
      </div>

      {/* Campaign ROI Table */}
      {campaignROI.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">ROI by Campaign</h2>
          </div>
          <div className="overflow-x-auto [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-slate-50 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th scope="col" className="px-4 py-3 text-left">Campaign</th>
                  <th scope="col" className="px-4 py-3 text-left">Platform</th>
                  <th scope="col" className="px-4 py-3 text-right">Leads</th>
                  <th scope="col" className="px-4 py-3 text-right">Visits</th>
                  <th scope="col" className="px-4 py-3 text-right">Bookings</th>
                  <th scope="col" className="px-4 py-3 text-right">Revenue</th>
                  <th scope="col" className="px-4 py-3 text-right">Spend</th>
                  <th scope="col" className="px-4 py-3 text-right">CPL</th>
                  <th scope="col" className="px-4 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaignROI.map((row) => {
                  const platformKey = (row.platform ?? 'other') as keyof typeof PLATFORM_CONFIG
                  const config = PLATFORM_CONFIG[platformKey] ?? PLATFORM_CONFIG.other
                  const unlinked = row.campaign_id === null
                  return (
                    <tr key={row.campaign_id ?? `unlinked:${row.campaign_name}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 text-sm">
                          {row.campaign_name ?? '—'}
                          {unlinked && (
                            <span title="Leads carry this campaign tag/name but no campaign matches it. Create a campaign with this name or utm_campaign (or edit one) to attribute its spend."
                              className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Unlinked
                            </span>
                          )}
                        </p>
                        {row.utm_campaign && <p className="text-xs text-slate-400 font-mono">{row.utm_campaign}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {row.platform && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{row.leads_count}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.site_visits_count}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.bookings_count}</td>
                      <td className="px-4 py-3 text-right text-slate-900">
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
                          <span className={`font-semibold ${row.roas >= 3 ? 'text-emerald-600' : row.roas >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                            {row.roas}x
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaigns Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Campaigns <span className="font-normal text-slate-400">· all-time spend</span></h2>
          <CampaignForm projects={projects} />
        </div>

        {campaigns.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {campaigns.map((c) => {
                const platformKey = c.platform as keyof typeof PLATFORM_CONFIG
                const config = PLATFORM_CONFIG[platformKey] ?? PLATFORM_CONFIG.other
                const spend = Number(c.spend)
                const budget = Number(c.budget)
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          <CampaignStatusToggle key={c.status} campaignId={c.id} status={c.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                          {c.project && <span>{c.project.name}</span>}
                          <span>{formatDate(c.start_date)}{c.end_date ? ` → ${formatDate(c.end_date)}` : ''}</span>
                          {c.utm_campaign && <span className="font-mono text-slate-400">{c.utm_campaign}</span>}
                          {c.meta_campaign_id && <span className="font-mono text-slate-400">Meta {c.meta_campaign_id}</span>}
                          {!c.utm_campaign && !c.meta_campaign_id && (
                            <span className="text-amber-600">Matched by name only — add a utm_campaign or Meta ID for reliable attribution</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(spend)} spent</p>
                        <p className="text-xs text-slate-500">{budget > 0 ? `of ${formatCurrency(budget)} budget` : 'no budget set'}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      {budget > 0 && (
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                          <div
                            className={`h-1.5 rounded-full ${spend > budget ? 'bg-red-500' : 'bg-primary-500'}`}
                            style={{ width: `${Math.min(100, (spend / budget) * 100)}%` }}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-4 flex-wrap">
                        <SpendLogForm campaignId={c.id} campaignName={c.name} />
                        <SpendHistory campaignId={c.id} campaignName={c.name} />
                        <CampaignForm projects={projects} campaign={c} />
                      </div>
                      <div className="mt-2">
                        <ActionButton label="Delete campaign" tone="danger"
                          confirm={`Delete campaign "${c.name}" and its spend log? Its leads stay, but show as unlinked. This cannot be undone.`}
                          action={deleteCampaign.bind(null, c.id)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {campaigns.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm bg-white rounded-xl border border-dashed border-slate-200">
            No campaigns yet. Add your first campaign to start tracking ROI.
          </div>
        )}
      </div>
    </div>
  )
}
