import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  /** When set, the card becomes a clickable link. Implies hover. */
  href?: string
}

const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }

export function Card({ children, className, padding = 'md', hover = false, href }: CardProps) {
  const base = cn(
    'bg-white rounded-xl border border-slate-200 shadow-sm',
    (hover || href) &&
      'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
    paddings[padding],
    className,
  )

  if (href) {
    return (
      <Link href={href} className={cn(base, 'block')}>
        {children}
      </Link>
    )
  }
  return <div className={base}>{children}</div>
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  iconBg?: string
  trend?: { value: number; label: string }
  accent?: string
  /** When set, the StatCard becomes a clickable link. */
  href?: string
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg = 'bg-indigo-50',
  trend,
  accent,
  href,
}: StatCardProps) {
  const inner = (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
          {trend && (
            <div
              className={cn(
                'mt-2 flex items-center gap-1 text-xs font-semibold',
                trend.value > 0 ? 'text-emerald-600' : 'text-red-500',
              )}
            >
              {trend.value > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl shrink-0', iconBg)}>{icon}</div>
      </div>
    </div>
  )

  const shell = cn(
    'relative overflow-hidden bg-white rounded-xl border border-slate-200',
    'shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
    accent && `border-l-[3px] ${accent}`,
  )

  if (href) {
    return (
      <Link href={href} className={cn(shell, 'block')}>
        {inner}
      </Link>
    )
  }
  return <div className={shell}>{inner}</div>
}
