'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCareerListing } from '@/lib/website/actions'
import { EMPLOYMENT_TYPES } from '@/types/website'
import { Plus } from 'lucide-react'

export default function CareerForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = await createCareerListing(formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to create listing')
      } else {
        ;(e.target as HTMLFormElement).reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 text-slate-500 text-sm rounded-xl hover:border-indigo-300 hover:text-indigo-600">
        <Plus size={16} /> Add Job Listing
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-slate-900">New Job Listing</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Title <span className="text-red-500">*</span></label>
          <input name="title" required placeholder="e.g. Sales Advisor — Jaipur"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Department <span className="text-red-500">*</span></label>
          <input name="department" required placeholder="e.g. Sales, HR, Marketing"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
          <select name="employment_type"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
          <input name="location" defaultValue="Jaipur"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
          <textarea name="description" required rows={4}
            placeholder="Describe the role, responsibilities, and what success looks like"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Requirements</label>
          <textarea name="requirements" rows={3}
            placeholder="Required qualifications, experience, and skills"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-xl hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Listing'}
        </button>
      </div>
    </form>
  )
}
