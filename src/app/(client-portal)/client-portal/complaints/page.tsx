export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { getPortalClientData } from '@/lib/portal/queries'
import { formatDate } from '@/lib/utils'
import { COMPLAINT_STATUS_CONFIG, COMPLAINT_CATEGORY_LABELS } from '@/types/clients'
import ComplaintForm from '@/components/client-portal/ComplaintForm'
import type { ComplaintStatus, ComplaintCategory } from '@/types/clients'

export default async function ClientPortalComplaintsPage() {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const data = await getPortalClientData(session.client.id)
  const { complaints } = data

  const openCount = complaints.filter((c) => c.status !== 'resolved').length

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Complaints & Requests</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {openCount > 0 ? `${openCount} open` : 'All resolved'} · {complaints.length} total
        </p>
      </div>

      <ComplaintForm clientId={session.client.id} bookingId={data.booking?.id} />

      {/* Complaint list */}
      {complaints.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-900 text-sm">Your Complaints</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {complaints.map((c) => {
              const cfg = COMPLAINT_STATUS_CONFIG[c.status as ComplaintStatus]
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h4 className="text-sm font-semibold text-slate-900">#{c.ticket_number}</h4>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>
                      {cfg?.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {COMPLAINT_CATEGORY_LABELS[c.category as ComplaintCategory] ?? c.category} · {formatDate(c.created_at)}
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>
                  {c.resolution_notes && (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg text-xs text-green-700">
                      <strong>Resolution:</strong> {c.resolution_notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
