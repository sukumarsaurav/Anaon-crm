'use client'

import { useState, useTransition } from 'react'
import { X, Pin } from 'lucide-react'
import { createAnnouncement } from '@/lib/team/actions'

interface Props {
  onClose: () => void
}

export default function AnnouncementForm({ onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createAnnouncement(formData)
      if (result.success) {
        onClose()
      } else {
        setError(result.error ?? 'Failed to create')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">New Announcement</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select
                name="type"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="announcement">Announcement</option>
                <option value="shoutout">Shoutout</option>
                <option value="alert">Alert</option>
                <option value="project_launch">Project Launch</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" name="is_pinned" value="true" className="rounded" />
                <span className="text-sm text-slate-700 flex items-center gap-1"><Pin size={13} /> Pin to top</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              name="title"
              required
              placeholder="New Project Launch — Jaipur Highlands"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Message</label>
            <textarea
              name="body"
              required
              rows={4}
              placeholder="Share the announcement details here..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expires at (optional)</label>
            <input
              name="expires_at"
              type="datetime-local"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              {isPending ? 'Posting...' : 'Post Announcement'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
