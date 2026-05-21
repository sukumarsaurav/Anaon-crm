'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLegalTemplate } from '@/lib/legal/actions'
import { LEGAL_DOCUMENT_TYPES, LEGAL_DOCUMENT_TYPE_LABELS } from '@/types/legal'
import { Plus, X } from 'lucide-react'

export default function LegalTemplateForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createLegalTemplate(fd)
      setLoading(false)
      if (result.success) { setOpen(false); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
        <Plus size={15} /> Add Template
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">New Legal Template</h3>
        <button onClick={() => setOpen(false)}><X size={16} className="text-slate-400" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Template Name <span className="text-red-500">*</span></label>
            <input name="name" required placeholder="e.g. Standard Booking Form v2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type <span className="text-red-500">*</span></label>
            <select name="type" required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {LEGAL_DOCUMENT_TYPES.map(t => (
                <option key={t} value={t}>{LEGAL_DOCUMENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea name="description" rows={2} placeholder="Brief description of this template..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">File URL</label>
            <input type="url" name="file_url" placeholder="https://..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Version</label>
            <input name="version" defaultValue="1.0" placeholder="1.0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Template'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
