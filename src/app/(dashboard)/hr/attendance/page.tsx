export const dynamic = 'force-dynamic'

import { todayIST, formatInIST } from '@/lib/datetime'
import Link from 'next/link'
import { getAttendanceLogs, getEmployees } from '@/lib/hr/queries'
import MarkAttendanceForm from '@/components/hr/MarkAttendanceForm'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Clock, MapPin } from 'lucide-react'
import { ATTENDANCE_STATUS_CONFIG, type AttendanceStatus } from '@/types/team'

export const metadata = { title: 'Attendance' }

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
}

function duration(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return null
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000)
  if (mins < 0) return null
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

/** After 09:30 IST. getHours() read the server clock (UTC), so 09:45 IST was 04:15 and never "late". */
function isLateIST(ts: string | null): boolean {
  if (!ts) return false
  const [h, m] = formatInIST(new Date(ts), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).split(':').map(Number)
  return h > 9 || (h === 9 && m > 30)
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = todayIST()
  const requested = (await searchParams).date
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today
  const [logs, employees] = await Promise.all([getAttendanceLogs(day), getEmployees()])

  const present = logs.filter(l => l.status === 'present').length
  const late = logs.filter(l => isLateIST(l.check_in_at)).length
  const recorded = new Set(logs.map((l) => l.user_id))
  const missing = employees.filter((e) => !recorded.has(e.id))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500">
            {day === today ? 'Today' : formatDate(day)} · {present} present{late > 0 && ` · ${late} late`} · {logs.length} records
          </p>
        </div>
        <form method="GET" className="ml-auto flex items-center gap-2">
          <input type="date" name="date" defaultValue={day} max={today} aria-label="Date"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button type="submit" className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Show</button>
        </form>
      </div>

      <MarkAttendanceForm employees={employees.map(e => ({ id: e.id, full_name: e.full_name }))} defaultDate={day} />

      <div className="flex gap-3">
        {[
          { label: 'Present', value: present, color: 'bg-green-50 text-green-700' },
          { label: 'Late Arrival', value: late, color: 'bg-amber-50 text-amber-700' },
          { label: 'No record', value: missing.length, color: 'bg-red-50 text-red-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex-1 rounded-xl p-4 ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
          No attendance records for this day yet.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">{formatDate(day)} — All Records</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {logs.map(log => {
              const isLate = isLateIST(log.check_in_at)
              const dur = duration(log.check_in_at, log.check_out_at)

              return (
                <div key={log.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">{log.employee?.full_name ?? 'Unknown'}</p>
                      {isLate && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Late</span>}
                      {log.status !== 'present' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ATTENDANCE_STATUS_CONFIG[log.status as AttendanceStatus]?.bg ?? 'bg-slate-100'} ${ATTENDANCE_STATUS_CONFIG[log.status as AttendanceStatus]?.color ?? 'text-slate-600'}`}>
                          {ATTENDANCE_STATUS_CONFIG[log.status as AttendanceStatus]?.label ?? log.status}
                        </span>
                      )}
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
      {missing.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">No record ({missing.length})</h2>
            <p className="text-xs text-slate-500">Not checked in and not marked. Use “Mark attendance” above to record absent or leave.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {missing.map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-sm text-slate-700">{e.full_name}<span className="text-xs text-slate-400"> · {e.designation ?? e.role}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
