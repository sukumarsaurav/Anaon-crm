export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBrokerByAuthUser, getBrokerStats, getBrokerLeadRegistrations, getBrokerPortalCommissions } from '@/lib/brokers/queries'
import { formatCurrency } from '@/lib/utils'
import { Users, DollarSign, TrendingUp, BookOpen, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { LEAD_REG_STATUS_CONFIG, BROKER_STATUS_CONFIG } from '@/types/brokers'
import { COMMISSION_STATUS_CONFIG } from '@/types/bookings'
import type { CommissionStatus } from '@/types/bookings'

export default async function BrokerPortalDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const broker = await getBrokerByAuthUser(user.id)
  if (!broker) redirect('/login')

  if (broker.status !== 'approved') {
    const cfg = BROKER_STATUS_CONFIG[broker.status]
    return (
      <div className="p-8 max-w-md mx-auto mt-20 text-center">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${cfg.color} ${cfg.bg} mb-4`}>
          {cfg.label}
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Account Not Yet Active</h1>
        <p className="text-slate-500 text-sm">
          {broker.status === 'pending'
            ? 'Your account is under review. ANON INDIA will contact you once approved.'
            : broker.status === 'rejected'
            ? `Your account was rejected. Reason: ${broker.rejected_reason ?? 'Not specified'}`
            : 'Your account has been deactivated. Please contact ANON INDIA for assistance.'}
        </p>
      </div>
    )
  }

  const [stats, recentLeads, commissions] = await Promise.all([
    getBrokerStats(broker.id),
    getBrokerLeadRegistrations(broker.id),
    getBrokerPortalCommissions(broker.id),
  ])

  const kpis = [
    { label: 'Leads Registered',  value: stats.total_leads,                       icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Bookings Converted', value: stats.total_bookings,                   icon: BookOpen,    color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Commission Earned',  value: formatCurrency(stats.commission_earned), icon: DollarSign,  color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Conversion Rate',    value: `${stats.conversion_rate}%`,             icon: TrendingUp,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {broker.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {broker.firm_name ?? ''} · Commission Rate: {broker.commission_rate}%
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${bg}`}><Icon size={18} className={color} /></div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent leads */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Leads</h3>
            <Link href="/broker-portal/leads" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No leads registered yet</p>
              <Link href="/broker-portal/leads"
                className="mt-3 inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                Register First Lead
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLeads.slice(0, 5).map((l) => {
                const cfg = LEAD_REG_STATUS_CONFIG[l.status]
                return (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{l.client_name}</p>
                      <p className="text-xs text-slate-400">{l.project?.name ?? 'No project specified'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Commission summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Commission Statement</h3>
            <Link href="/broker-portal/commissions" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Full statement <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-800">Pending</p>
              <p className="font-bold text-amber-700">{formatCurrency(stats.commission_pending)}</p>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">Paid to Date</p>
              <p className="font-bold text-green-700">{formatCurrency(stats.commission_paid)}</p>
            </div>
          </div>
          {commissions.slice(0, 4).map((c) => {
            const cfg = COMMISSION_STATUS_CONFIG[c.status as CommissionStatus]
            return (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                <span className="text-slate-600">{c.booking?.booking_number ?? '—'}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{formatCurrency(c.commission_amount ?? 0)}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>{cfg?.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
