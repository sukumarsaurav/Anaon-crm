export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAttendanceLogs } from '@/lib/hr/queries'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Clock, MapPin } from 'lucide-react'

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function duration(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return null
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000)
  if (mins < 0) return null
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default async function AttendancePage() {
  const today = new Date().toISOString().split('T')[0]
  const logs = await getAttendanceLogs(today)

  const present = logs.filter(l => l.status === 'present').length
  const late = logs.filter(l => {
    if (!l.check_in_at) return false
    const t = new Date(l.check_in_at)
    return t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 30)
  }).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500">
            Today · {present} present{late > 0 && ` · ${late} late`} · {logs.length} records
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {[
          { label: 'Present', value: present, color: 'bg-green-50 text-green-700' },
          { label: 'Late Arrival', value: late, color: 'bg-amber-50 text-amber-700' },
          { label: 'Total Records', value: logs.length, color: 'bg-slate-100 text-slate-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex-1 rounded-xl p-4 ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
          No attendance records for today yet.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">{formatDate(today)} — All Records</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {logs.map(log => {
              const checkInTime = new Date(log.check_in_at ?? '')
              const isLate = log.check_in_at && (checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > 30))
              const dur = duration(log.check_in_at, log.check_out_at)

              return (
                <div key={log.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">{log.employee?.full_name ?? 'Unknown'}</p>
                      {isLate && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Late</span>}
                    </div>
                    <p className="text-xs text-slate-400">{log.employee?.designation}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500 space-y-0.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Clock size={11} />
                      <span>In: <span className={`font-medium ${isLate ? 'text-amber-600' : 'text-green-600'}`}>{formatTime(log.check_in_at)}</span></span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <Clock size={11} />
                      <span>Out: <span className="font-medium text-slate-700">{formatTime(log.check_out_at)}</span></span>
                    </div>
                    {dur && <p className="text-slate-400">{dur}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
