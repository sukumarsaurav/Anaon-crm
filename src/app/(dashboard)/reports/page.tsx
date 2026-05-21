export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getExecDashboard, getDailyLeadTrend, getLeadsBySource, getBookingsByProject, getMonthlyRevenueTrend } from '@/lib/reports/queries'
import KPICard from '@/components/reports/KPICard'
import MiniBarChart from '@/components/reports/MiniBarChart'
import SparkLine from '@/components/reports/SparkLine'
import { BarChart3, Users, MapPin, BookOpen, IndianRupee, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default async function ReportsPage() {
  const [exec, dailyTrend, bySource, byProject, revenuetrend] = await Promise.all([
    getExecDashboard(),
    getDailyLeadTrend(30),
    getLeadsBySource(),
    getBookingsByProject(),
    getMonthlyRevenueTrend(12),
  ])

  const fmtCrore = (v: number) => formatCurrency(v, { precision: 2 })

  const reportSections = [
    { label: 'Lead Reports', href: '/reports/leads', icon: Users, desc: 'Funnel, SLA compliance, ageing, source performance' },
    { label: 'Sales Reports', href: '/reports/sales', icon: BarChart3, desc: 'Advisor scorecard, bookings, site visits, targets' },
    { label: 'Financial Reports', href: '/reports/financial', icon: IndianRupee, desc: 'Collections, outstanding, broker commissions' },
    { label: 'Inventory Reports', href: '/reports/inventory', icon: MapPin, desc: 'Availability, plot ageing, soft holds' },
  ]

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Executive dashboard — current month vs last month</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Leads" value={exec.leads.curr} trend={exec.leads.trend} sub={`${exec.leads.prev} last month`} />
        <KPICard label="Site Visits" value={exec.visits.curr} trend={exec.visits.trend} />
        <KPICard label="Bookings" value={exec.bookings.curr} trend={exec.bookings.trend} />
        <KPICard label="Revenue" value={fmtCrore(exec.revenue.curr)} trend={exec.revenue.trend} color="text-indigo-700" />
        <KPICard label="Collections" value={fmtCrore(exec.collections)} sub={`${fmtCrore(exec.outstanding)} outstanding`} />
      </div>

      {/* Conversion rates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lead → Visit Rate</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{exec.leadToVisitRate}%</p>
          <div className="mt-3 bg-slate-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(exec.leadToVisitRate, 100)}%` }} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Visit → Booking Rate</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{exec.visitToBookingRate}%</p>
          <div className="mt-3 bg-slate-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.min(exec.visitToBookingRate, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily lead trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Daily Lead Trend — Last 30 Days</h3>
          <SparkLine data={dailyTrend} height={100} />
        </div>

        {/* Monthly revenue trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Monthly Revenue Trend</h3>
          {revenuetrend.length > 0 ? (
            <div className="space-y-1.5">
              {(() => {
                const maxRev = Math.max(...revenuetrend.map(r => r.revenue), 1)
                return revenuetrend.slice(-8).map(r => (
                  <div key={r.month} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-14 shrink-0">{r.month.slice(5)}/{r.month.slice(0, 4).slice(2)}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-16 text-right shrink-0">{fmtCrore(r.revenue)}</span>
                  </div>
                ))
              })()}
            </div>
          ) : <p className="text-sm text-slate-400">No booking data yet.</p>}
        </div>

        {/* Leads by source */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Leads by Source</h3>
          {bySource.length > 0
            ? <MiniBarChart data={bySource.map(s => ({ label: s.source, value: s.count }))} colorClass="bg-blue-400" />
            : <p className="text-sm text-slate-400">No leads with UTM data yet.</p>}
        </div>

        {/* Bookings by project */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Revenue by Project</h3>
          {byProject.length > 0
            ? <MiniBarChart data={byProject.map(p => ({ label: p.project, value: p.revenue }))} colorClass="bg-green-500" formatValue={fmtCrore} />
            : <p className="text-sm text-slate-400">No confirmed bookings yet.</p>}
        </div>
      </div>

      {/* Navigation to sub-reports */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-4">Detailed Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reportSections.map(({ label, href, icon: Icon, desc }) => (
            <Link key={href} href={href}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all group flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                <Icon size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-400 mt-1 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
