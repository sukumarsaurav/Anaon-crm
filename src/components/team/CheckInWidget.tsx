'use client'

import { useState, useTransition } from 'react'
import { checkIn, checkOut } from '@/lib/team/actions'
import type { AttendanceLog } from '@/types/team'

interface Props {
  todayLog: AttendanceLog | null
}

export default function CheckInWidget({ todayLog }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isCheckedIn = !!todayLog?.check_in_at
  const isCheckedOut = !!todayLog?.check_out_at

  function formatTime(iso: string | null) {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  async function getLocation(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) return null
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      )
    })
  }

  function handleCheckIn() {
    setError(null)
    startTransition(async () => {
      const loc = await getLocation()
      const result = await checkIn(loc?.lat, loc?.lng)
      if (!result.success) setError(result.error ?? 'Failed')
    })
  }

  function handleCheckOut() {
    setError(null)
    startTransition(async () => {
      const loc = await getLocation()
      const result = await checkOut(loc?.lat, loc?.lng)
      if (!result.success) setError(result.error ?? 'Failed')
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="font-semibold text-slate-900 mb-3">Today's Attendance</h3>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1">Check In</div>
          <div className={`text-lg font-bold ${isCheckedIn ? 'text-green-600' : 'text-slate-300'}`}>
            {formatTime(todayLog?.check_in_at ?? null)}
          </div>
        </div>
        <div className="flex-1 border-t-2 border-dashed border-slate-200" />
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1">Check Out</div>
          <div className={`text-lg font-bold ${isCheckedOut ? 'text-blue-600' : 'text-slate-300'}`}>
            {formatTime(todayLog?.check_out_at ?? null)}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex gap-2">
        {!isCheckedIn && (
          <button
            onClick={handleCheckIn}
            disabled={isPending}
            className="flex-1 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-40"
          >
            {isPending ? 'Checking in...' : 'Check In'}
          </button>
        )}
        {isCheckedIn && !isCheckedOut && (
          <button
            onClick={handleCheckOut}
            disabled={isPending}
            className="flex-1 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40"
          >
            {isPending ? 'Checking out...' : '→ Check Out'}
          </button>
        )}
        {isCheckedIn && isCheckedOut && (
          <div className="flex-1 py-2 text-center text-sm text-slate-500 bg-slate-50 rounded-lg">
            Day complete
          </div>
        )}
      </div>
    </div>
  )
}
