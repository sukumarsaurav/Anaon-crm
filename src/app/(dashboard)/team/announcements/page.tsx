'use client'

import { useState, useEffect, useTransition } from 'react'
import { getAnnouncements } from '@/lib/team/queries'
import AnnouncementFeed from '@/components/team/AnnouncementFeed'
import AnnouncementForm from '@/components/team/AnnouncementForm'
import type { Announcement } from '@/types/team'

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [, startTransition] = useTransition()

  function load() {
    startTransition(async () => {
      const data = await getAnnouncements()
      setAnnouncements(data)
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">Team-wide updates, shoutouts, and alerts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          + New Announcement
        </button>
      </div>

      <AnnouncementFeed announcements={announcements} canManage={true} />

      {showForm && (
        <AnnouncementForm
          onClose={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}
