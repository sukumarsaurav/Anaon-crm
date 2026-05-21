'use client'

import { useState, useTransition } from 'react'
import { addClientDocument, verifyClientDocument } from '@/lib/clients/actions'
import { DOC_TYPE_LABELS } from '@/types/clients'
import type { ClientDocument } from '@/types/clients'
import { formatDate } from '@/lib/utils'
import { FileText, ExternalLink, CheckCircle2, XCircle, Plus } from 'lucide-react'

interface Props {
  clientId:  string
  documents: ClientDocument[]
  canManage: boolean
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'text-slate-500',  bg: 'bg-slate-100' },
  uploaded: { label: 'Uploaded', color: 'text-amber-700', bg: 'bg-amber-50' },
  verified: { label: 'Verified', color: 'text-green-700', bg: 'bg-green-50' },
  rejected: { label: 'Rejected', color: 'text-red-700',   bg: 'bg-red-50'   },
}

export default function ClientDocumentList({ clientId, documents, canManage }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('client_id', clientId)
    setError(null)
    startTransition(async () => {
      const result = await addClientDocument(fd)
      if (result.success) {
        setShowForm(false)
        ;(e.target as HTMLFormElement).reset()
      } else setError(result.error ?? 'Failed')
    })
  }

  function handleVerify(docId: string, status: 'verified' | 'rejected') {
    startTransition(async () => { await verifyClientDocument(docId, status) })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Documents</h3>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium">
          <Plus size={12} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-indigo-50 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Document Type *</label>
              <select name="document_type" required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(DOC_TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Label / Name</label>
              <input name="name" placeholder="Aadhar Front & Back"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">File URL</label>
              <input name="file_url" type="url" placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
              <input name="expiry_date" type="date"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input name="notes"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
              {isPending ? 'Saving...' : 'Add Document'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No documents uploaded</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const scfg = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
            return (
              <div key={doc.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={15} className="text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {doc.name ?? DOC_TYPE_LABELS[doc.document_type as keyof typeof DOC_TYPE_LABELS] ?? doc.document_type}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${scfg.color} ${scfg.bg}`}>
                        {scfg.label}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
                      {doc.expiry_date && (
                        <span className="text-xs text-amber-600">Exp: {formatDate(doc.expiry_date)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-indigo-600">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {canManage && doc.status === 'uploaded' && (
                    <>
                      <button onClick={() => handleVerify(doc.id, 'verified')} disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-green-600" title="Verify">
                        <CheckCircle2 size={15} />
                      </button>
                      <button onClick={() => handleVerify(doc.id, 'rejected')} disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-red-600" title="Reject">
                        <XCircle size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
