import { ATTENDANCE_STATUS_CONFIG } from '@/types/team'
import type { AttendanceLog, AttendanceStatus } from '@/types/team'

interface Props {
  logs: AttendanceLog[]
  month: number
  year: number
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getStatusForDate(date: string, logs: AttendanceLog[]): AttendanceStatus | null {
  const log = logs.find((l) => l.date === date)
  if (log) return log.status

  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  if (day === 0) return 'weekend'  // Sunday
  return null
}

export default function AttendanceCalendar({ logs, month, year }: Props) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  // Monday=0 offset
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const cells: Array<{ date: string | null; status: AttendanceStatus | null }> = [
    ...Array(startOffset).fill({ date: null, status: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { date: dateStr, status: getStatusForDate(dateStr, logs) }
    }),
  ]

  // Summary
  const counts: Record<AttendanceStatus, number> = {
    present: 0, absent: 0, half_day: 0, on_leave: 0, holiday: 0, weekend: 0,
  }
  logs.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1 })
  cells.forEach((c) => { if (c.status === 'weekend' && !logs.find((l) => l.date === c.date)) counts.weekend++ })

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="font-semibold text-slate-900 mb-4">Attendance Calendar</h3>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />
          const cfg = cell.status ? ATTENDANCE_STATUS_CONFIG[cell.status] : null
          const isToday = cell.date === today

          return (
            <div
              key={cell.date}
              title={cell.status ?? 'No record'}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium cursor-default ${
                cfg ? `${cfg.color} ${cfg.bg}` : 'text-slate-400 bg-slate-50'
              } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
            >
              <span>{new Date(cell.date).getDate()}</span>
              {cell.status && cell.status !== 'weekend' && (
                <span className="text-[8px] leading-none opacity-70">
                  {cell.status === 'present' ? 'P' : cell.status === 'absent' ? 'A' : cell.status === 'half_day' ? 'H' : cell.status === 'on_leave' ? 'L' : 'H'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200">
        {(Object.entries(counts) as Array<[AttendanceStatus, number]>)
          .filter(([, v]) => v > 0)
          .map(([status, count]) => {
            const cfg = ATTENDANCE_STATUS_CONFIG[status]
            return (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.bg.replace('bg-', 'bg-').replace('100', '500')}`} />
                <span className="text-xs text-slate-600">{cfg.label}: <strong>{count}</strong></span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
