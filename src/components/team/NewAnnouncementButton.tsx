'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AnnouncementForm from '@/components/team/AnnouncementForm'

export default function NewAnnouncementButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
        + New Announcement
      </button>
      {open && <AnnouncementForm onClose={() => { setOpen(false); router.refresh() }} />}
    </>
  )
}
