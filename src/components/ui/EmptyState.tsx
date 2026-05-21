import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  /** When true, renders inside a Card-style wrapper. Default: no wrapper. */
  bordered?: boolean
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  bordered = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        bordered &&
          'bg-white rounded-xl border border-slate-200',
        className,
      )}
    >
      {icon && (
        <div className="text-slate-300 mb-3" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
