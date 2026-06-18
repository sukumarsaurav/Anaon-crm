import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'indigo' | 'violet' | 'orange' | 'amber' | 'slate' | 'emerald' | 'purple' | 'teal'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

const variantStyles = {
  gray: 'bg-slate-100 text-slate-800',
  slate: 'bg-slate-100 text-slate-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  yellow: 'bg-amber-100 text-amber-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  indigo: 'bg-primary-100 text-primary-800',
  violet: 'bg-violet-100 text-violet-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  teal: 'bg-teal-100 text-teal-800',
}

const dotStyles = {
  gray: 'bg-slate-500',
  slate: 'bg-slate-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  emerald: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  indigo: 'bg-primary-500',
  violet: 'bg-violet-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
}

export default function Badge({ children, variant = 'gray', size = 'md', dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotStyles[variant])} />}
      {children}
    </span>
  )
}
