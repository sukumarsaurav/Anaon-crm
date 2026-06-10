export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { getBrokerByAuthUser, getBrokerStats, getBrokerPortalCommissions } from '@/lib/brokers/queries'
import { formatCurrency, formatDate } from '@/lib/utils'
import { COMMISSION_STATUS_CONFIG } from '@/types/bookings'
import type { CommissionStatus } from '@/types/bookings'
import { DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react'

export default async function BrokerCommissionsPage() {
  const user = (await getProfile())?.user
  if (!user) redirect('/login')

  const broker = await getBrokerByAuthUser(user.id)
  if (!broker) redirect('/login')

  const [stats, commissions] = await Promise.all([
    getBrokerStats(broker.id),
    getBrokerPortalCommissions(broker.id),
  ])

  const kpis = [
    { label: 'Total Earned',  value: formatCurrency(stats.commission_earned),  icon: TrendingUp,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending',       value: formatCurrency(stats.commission_pending),  icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Paid',          value: formatCurrency(stats.commission_paid),     icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Bookings',      value: stats.total_bookings,                      icon: DollarSign,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Commission Statement</h1>
        <p className="text-sm text-slate-500 mt-1">Track your earnings across all bookings</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${bg}`}><Icon size={18} className={color} /></div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Booking</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Booking Value</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Commission %</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Commission Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Paid On</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">UTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commissions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No commissions yet. Once your leads convert to bookings, commissions will appear here.
                </td>
              </tr>
            )}
            {commissions.map((c) => {
              const cfg = COMMISSION_STATUS_CONFIG[c.status as CommissionStatus]
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.booking?.booking_number ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(c.booking_value)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.commission_pct ?? broker.commission_rate}%</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatCurrency(c.commission_amount ?? 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>{cfg?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.paid_at ? formatDate(c.paid_at) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.utr_number ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-1">Commission Lifecycle</p>
        <p>Lead Converted → <span className="text-amber-600">Pending</span> (calculated automatically) → <span className="text-blue-600">Approved</span> (by ANON INDIA manager) → <span className="text-green-600">Paid</span> (UTR provided). Commissions on cancelled bookings are voided.</p>
      </div>
    </div>
  )
}
