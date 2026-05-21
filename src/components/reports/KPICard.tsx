import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  trend?: number | null
  sub?: string
  color?: string
}

export default function KPICard({ label, value, trend, sub, color = 'text-slate-900' }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      {trend !== null && trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-slate-400'
        }`}>
          {trend > 0 ? <TrendingUp size={13} /> : trend < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
          {trend > 0 ? '+' : ''}{trend}% vs last month
        </div>
      )}
    </div>
  )
}
