export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { getPortalClientData } from '@/lib/portal/queries'
import { formatDate } from '@/lib/utils'
import { DOC_TYPE_LABELS } from '@/types/clients'

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-700', bg: 'bg-amber-50'  },
  uploaded: { label: 'Uploaded', color: 'text-blue-700',  bg: 'bg-blue-50'   },
  verified: { label: 'Verified', color: 'text-green-700', bg: 'bg-green-50'  },
  rejected: { label: 'Rejected', color: 'text-red-700',   bg: 'bg-red-50'    },
}
import { ExternalLink, FileText, Upload } from 'lucide-react'
import type { DocType, DocStatus } from '@/types/clients'

export default async function ClientPortalDocumentsPage() {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const data = await getPortalClientData(session.client.id)
  const { documents, booking } = data

  // Documents from booking
  const bookingDocs = booking ? [
    { label: 'Allotment Letter', url: booking.allotment_letter_url,  sentAt: booking.allotment_letter_sent_at },
    { label: 'Agreement to Sale', url: booking.agreement_url,        sentAt: null },
    { label: 'Booking Form',     url: booking.booking_form_url,      sentAt: null },
  ].filter((d) => d.url) : []

  const clientDocs = documents.filter((d) => d.file_url)

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Documents</h1>
        <p className="text-sm text-slate-500 mt-0.5">Download and manage your property documents</p>
      </div>

      {/* Booking documents */}
      {bookingDocs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-900 text-sm">Property Documents</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {bookingDocs.map((doc) => (
              <div key={doc.label} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <FileText size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{doc.label}</p>
                    {doc.sentAt && <p className="text-xs text-green-600">Sent {formatDate(doc.sentAt)}</p>}
                  </div>
                </div>
                <a href={doc.url!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-100">
                  <ExternalLink size={12} /> Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client-uploaded documents */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900 text-sm">Your Submitted Documents</h3>
        </div>
        {clientDocs.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No documents submitted yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {clientDocs.map((doc) => {
              const cfg = DOC_STATUS_CONFIG[doc.status as DocStatus]
              return (
                <div key={doc.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <FileText size={16} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {DOC_TYPE_LABELS[doc.document_type as DocType] ?? doc.document_type}
                      </p>
                      <p className="text-xs text-slate-400">Uploaded {formatDate(doc.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>
                      {cfg?.label}
                    </span>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-600">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Upload size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Need to upload a document?</p>
          <p className="text-xs text-blue-600 mt-0.5">
            KYC documents, loan sanction letters, and other requested documents can be submitted by contacting your ANON INDIA advisor or through the Support section.
          </p>
        </div>
      </div>
    </div>
  )
}
