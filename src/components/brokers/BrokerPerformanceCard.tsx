import { formatCurrency } from '@/lib/utils'
import type { BrokerStats } from '@/types/brokers'
import { TrendingUp, Users, BookOpen, DollarSign } from 'lucide-react'

export default function BrokerPerformanceCard({ stats }: { stats: BrokerStats }) {
  const tiles = [
    { label: 'Leads Registered',   value: stats.total_leads,                 icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Bookings Converted', value: stats.total_bookings,              icon: BookOpen,    color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Conversion Rate',    value: `${stats.conversion_rate}%`,       icon: TrendingUp,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Commission Earned',  value: formatCurrency(stats.commission_earned), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${bg}`}>
            <Icon size={18} className={color} />
          </div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-900">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
