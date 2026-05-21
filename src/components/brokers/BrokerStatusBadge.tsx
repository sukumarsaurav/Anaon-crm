import { BROKER_STATUS_CONFIG } from '@/types/brokers'
import type { BrokerStatus } from '@/types/brokers'

export default function BrokerStatusBadge({ status }: { status: BrokerStatus }) {
  const cfg = BROKER_STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}
