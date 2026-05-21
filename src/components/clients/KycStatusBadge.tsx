import { KYC_STATUS_CONFIG } from '@/types/clients'
import StatusBadge from '@/components/ui/StatusBadge'
import type { KycStatus } from '@/types/clients'

export default function KycStatusBadge({ status }: { status: KycStatus }) {
  return <StatusBadge config={KYC_STATUS_CONFIG[status]} />
}
