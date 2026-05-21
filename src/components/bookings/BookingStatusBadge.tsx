import { BOOKING_STATUS_CONFIG } from '@/types/bookings'
import StatusBadge from '@/components/ui/StatusBadge'
import type { BookingStatus } from '@/types/bookings'

export default function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <StatusBadge config={BOOKING_STATUS_CONFIG[status]} />
}
