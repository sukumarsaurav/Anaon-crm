import { STAGE_CONFIG } from '@/types/leads'
import type { LeadStage } from '@/types/leads'
import { cn } from '@/lib/utils'

interface StageBadgeProps {
  stage: LeadStage
  size?: 'sm' | 'md'
}

export default function StageBadge({ stage, size = 'md' }: StageBadgeProps) {
  const config = STAGE_CONFIG[stage]
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        config.bgColor,
        config.textColor,
        config.borderColor
      )}
    >
      {config.label}
    </span>
  )
}
