import type { LeadTemperature } from '@/types/leads'
import { cn } from '@/lib/utils'

const config = {
  hot:  { label: 'Hot',  dot: 'bg-red-500',   className: 'bg-red-50 text-red-700 border-red-200' },
  warm: { label: 'Warm', dot: 'bg-amber-400',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cold: { label: 'Cold', dot: 'bg-blue-400',   className: 'bg-blue-50 text-blue-700 border-blue-200' },
}

export default function TemperatureBadge({
  temperature,
  showLabel = true,
}: {
  temperature: LeadTemperature
  showLabel?: boolean
}) {
  const { label, dot, className } = config[temperature]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
