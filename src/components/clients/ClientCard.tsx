import { Card } from '@/components/ui/Card'
import { Phone, Mail, Building2 } from 'lucide-react'
import KycStatusBadge from './KycStatusBadge'
import type { Client } from '@/types/clients'
import Avatar from '@/components/ui/Avatar'

interface Props {
  client: Client
  bookingCount?: number
}

export default function ClientCard({ client, bookingCount }: Props) {
  const initials = client.full_name
    .split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <Card href={`/clients/${client.id}`} padding="sm">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar name={client.full_name} src={client.photo_url} className="size-11" textClassName="text-sm font-bold" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-sm truncate">{client.full_name}</h3>
            <KycStatusBadge status={client.kyc_status} />
          </div>

          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Phone size={14} /> <span>{client.phone}</span>
            </div>
            {client.email && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Mail size={14} /> <span className="truncate">{client.email}</span>
              </div>
            )}
          </div>

          {bookingCount !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-primary-600">
              <Building2 size={14} />
              <span>{bookingCount} booking{bookingCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
