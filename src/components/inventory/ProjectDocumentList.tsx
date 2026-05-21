'use client'

import { useState, useTransition } from 'react'
import { addProjectDocument } from '@/lib/inventory/actions'
import { DOCUMENT_CATEGORY_LABELS } from '@/types/inventory'
import type { ProjectDocument } from '@/types/inventory'
import { formatDate } from '@/lib/utils'
import { FileText, ExternalLink, Plus } from 'lucide-react'

interface Props {
  projectId: string
  documents: ProjectDocument[]
  canManage: boolean
}

export default function ProjectDocumentList({ projectId, documents, canManage }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('project_id', projectId)
    setError(null)
    startTransition(async () => {
      const result = await addProjectDocument(formData)
      if (result.success) {
        setShowForm(false)
        ;(e.target as HTMLFormElement).reset()
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Documents</h3>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium">
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-indigo-50 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Document Name *</label>
              <input name="name" required placeholder="RERA Certificate 2024"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
              <select name="category" required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Visibility</label>
              <select name="is_public"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="false">Internal only</option>
                <option value="true">Public (visible to all)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">File URL *</label>
              <input name="file_url" required type="url" placeholder="https://..."
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
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                  <p className="text-xs text-slate-500">
                    {DOCUMENT_CATEGORY_LABELS[doc.category]} · {formatDate(doc.created_at)}
                    {!doc.is_public && <span className="ml-2 text-amber-600">Internal</span>}
                  </p>
                </div>
              </div>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="ml-3 p-1.5 text-slate-400 hover:text-indigo-600 shrink-0">
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
