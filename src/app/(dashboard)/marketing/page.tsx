export const dynamic = 'force-dynamic'

import { getMarketingCampaigns, getSourceROI, getCampaignROI, getMarketingStats } from '@/lib/marketing/queries'
import { createClient } from '@/lib/supabase/server'
import { PLATFORM_CONFIG } from '@/types/marketing'
import { formatDate, formatCurrency } from '@/lib/utils'
import CampaignForm from '@/components/marketing/CampaignForm'
import CampaignStatusToggle from '@/components/marketing/CampaignStatusToggle'
import SpendLogForm from '@/components/marketing/SpendLogForm'
import ROITable from '@/components/marketing/ROITable'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { TrendingUp, Target, Users, IndianRupee, Megaphone, MousePointerClick } from 'lucide-react'

export default async function MarketingPage() {
  const supabase = await createClient()
  const [campaigns, sourceROI, campaignROI, stats, projectsRes] = await Promise.all([
    getMarketingCampaigns(),
    getSourceROI(),
    getCampaignROI(),
    getMarketingStats(),
    supabase.from('projects').select('id, name').order('name'),
  ])
  const projects = projectsRes.data ?? []

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Marketing ROI"
        subtitle={
          <>
            {stats.activeCampaigns} active campaigns · {formatCurrency(stats.totalSpend)} spend · {formatCurrency(stats.totalRevenue)} revenue
            {stats.overallROAS !== null && <span className="ml-2 font-medium text-indigo-600">{stats.overallROAS}x ROAS</span>}
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Active Campaigns', value: stats.activeCampaigns, icon: Megaphone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Paid Leads', value: stats.paidLeads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Site Visits', value: stats.totalSiteVisits, icon: MousePointerClick, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Bookings', value: stats.totalBookings, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Campaign</th>
                  <th className="px-4 py-3 text-left">Platform</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Visits</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">CPL</th>
                  <th className="px-4 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaignROI.map((row, i) => {
                  const platformKey = (row.platform ?? 'other') as keyof typeof PLATFORM_CONFIG
                  const config = PLATFORM_CONFIG[platformKey] ?? PLATFORM_CONFIG.other
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 text-sm">{row.campaign_name ?? row.utm_campaign ?? '—'}</p>
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
          <h2 className="text-sm font-semibold text-slate-900">Campaigns</h2>
          <CampaignForm projects={projects} />
        </div>

        {campaigns.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {campaigns.map((c) => {
                const platformKey = c.platform as keyof typeof PLATFORM_CONFIG
                const config = PLATFORM_CONFIG[platformKey] ?? PLATFORM_CONFIG.other
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          <CampaignStatusToggle campaignId={c.id} status={c.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {c.project && <span>{c.project.name}</span>}
                          <span>{formatDate(c.start_date)}{c.end_date ? ` → ${formatDate(c.end_date)}` : ''}</span>
                          {c.utm_campaign && <span className="font-mono text-slate-400">{c.utm_campaign}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(c.spend)} spent</p>
                        <p className="text-xs text-slate-500">of {formatCurrency(c.budget)} budget</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      {c.budget > 0 && (
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                          <div
                            className={`h-1.5 rounded-full ${c.spend > c.budget ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, (c.spend / c.budget) * 100)}%` }}
                          />
                        </div>
                      )}
                      <SpendLogForm campaignId={c.id} campaignName={c.name} />
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
