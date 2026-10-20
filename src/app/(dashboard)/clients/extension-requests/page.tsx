export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getPaymentExtensionRequests } from '@/lib/portal/queries'
import { getProfile } from '@/lib/supabase/getProfile'
import { EXTENSION_STATUS_CONFIG } from '@/types/portal'
import { formatCurrency } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import ExtensionReviewButtons from '@/components/clients/ExtensionReviewButtons'
import { CalendarClock } from 'lucide-react'

export const metadata = { title: 'Extension Requests' }

export default async function ExtensionRequestsPage() {
  const [requests, session] = await Promise.all([getPaymentExtensionRequests(), getProfile()])
  const canReview = ['admin', 'manager'].includes(session?.profile?.role ?? '')
  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Payment Extension Requests"
        subtitle={`${pending.length} pending · ${requests.length} total`}
        backHref="/clients"
      />

      {requests.length === 0 ? (
        <EmptyState bordered icon={<CalendarClock size={40} />} title="No requests"
          description="Requests from the client portal's “Request extension” form appear here" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {requests.map((r) => {
            const cfg = EXTENSION_STATUS_CONFIG[r.status]
            return (
              <div key={r.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Link href={`/clients/${r.client_id}`} className="font-medium text-slate-900 hover:text-primary-600">
                      {r.client?.full_name ?? `Client ${r.client_id.slice(0, 8)}`}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <p className="text-slate-600">
                    Installment #{r.payment?.installment_number ?? '—'}
                    {r.payment ? ` · ${formatCurrency(r.payment.amount_due)} due ${r.payment.due_date}` : ''}
                  </p>
                  <p className="text-slate-600">Wants it moved to <strong>{r.requested_date}</strong></p>
                  <p className="text-slate-500">“{r.reason}”</p>
                  {r.admin_notes && <p className="text-xs text-slate-400">Note: {r.admin_notes}</p>}
                </div>
                {canReview && r.status === 'pending' && <ExtensionReviewButtons requestId={r.id} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
