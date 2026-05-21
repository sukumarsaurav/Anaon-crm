import { PLOT_STATUS_CONFIG } from '@/types/inventory'
import type { PlotStatus } from '@/types/inventory'

export default function PlotStatusBadge({ status }: { status: PlotStatus }) {
  const cfg = PLOT_STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}
