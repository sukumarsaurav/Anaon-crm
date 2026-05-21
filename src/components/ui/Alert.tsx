import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children?: React.ReactNode
  icon?: React.ReactNode
  onDismiss?: () => void
  className?: string
  /** Use on dark backgrounds (auth pages). Inverts the surface. */
  onDark?: boolean
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; icon: React.ReactNode; iconColor: string; titleColor: string; bodyColor: string }> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Info size={18} />,
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    bodyColor: 'text-blue-700',
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <CheckCircle2 size={18} />,
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-900',
    bodyColor: 'text-emerald-700',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <AlertTriangle size={18} />,
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    bodyColor: 'text-amber-700',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: <XCircle size={18} />,
    iconColor: 'text-red-600',
    titleColor: 'text-red-900',
    bodyColor: 'text-red-700',
  },
}

const darkVariantStyles: Record<AlertVariant, { bg: string; border: string; text: string }> = {
  info: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-100' },
  success: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-100' },
  warning: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-100' },
  error: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-100' },
}

export default function Alert({
  variant = 'info',
  title,
  children,
  icon,
  onDismiss,
  className,
  onDark = false,
}: AlertProps) {
  if (onDark) {
    const s = darkVariantStyles[variant]
    return (
      <div
        role="alert"
        className={cn('rounded-xl border px-4 py-3 text-sm', s.bg, s.border, s.text, className)}
      >
        {title && <p className="font-medium mb-0.5">{title}</p>}
        {children}
      </div>
    )
  }

  const s = variantStyles[variant]
  return (
    <div
      role="alert"
      className={cn('rounded-xl border p-4 flex gap-3 items-start', s.bg, s.border, className)}
    >
      <div className={cn('shrink-0 mt-0.5', s.iconColor)} aria-hidden="true">
        {icon ?? s.icon}
      </div>
      <div className="flex-1 min-w-0 text-sm">
        {title && <p className={cn('font-semibold mb-0.5', s.titleColor)}>{title}</p>}
        {children && <div className={cn(s.bodyColor)}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn('shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors', s.iconColor)}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
