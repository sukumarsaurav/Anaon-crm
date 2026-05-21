import { cn } from '@/lib/utils'

/**
 * Status badge. Wraps the existing `_STATUS_CONFIG` shape used across
 * `src/types/*` so every status pill in the app has the same padding,
 * radius, and font weight.
 *
 * Pass `config` (e.g. `KYC_STATUS_CONFIG[client.kyc_status]`) and the
 * label/colors come from the central type definition.
 */
interface StatusConfig {
  label: string
  /** Tailwind text-* class (e.g. 'text-amber-700') */
  color: string
  /** Tailwind bg-* class (e.g. 'bg-amber-50') */
  bg: string
}

interface StatusBadgeProps {
  config: StatusConfig
  /** Override the label from config */
  label?: string
  size?: 'sm' | 'md'
  /** Show a colored dot before the label. Matches the bg saturation. */
  dot?: boolean
  className?: string
}

export default function StatusBadge({
  config,
  label,
  size = 'md',
  dot,
  className,
}: StatusBadgeProps) {
  // Derive a saturated dot color from the bg class (bg-amber-50 → bg-amber-500)
  const dotClass = config.bg.replace(/-(\d{2,3})$/, '-500')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        config.bg,
        config.color,
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />}
      {label ?? config.label}
    </span>
  )
}
