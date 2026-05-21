'use client'

import { useState } from 'react'
import LeaveApplyForm from './LeaveApplyForm'

export default function AttendancePageClient() {
  const [showLeave, setShowLeave] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowLeave(true)}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
      >
        + Apply Leave
      </button>
      {showLeave && <LeaveApplyForm onClose={() => setShowLeave(false)} />}
    </>
  )
}
