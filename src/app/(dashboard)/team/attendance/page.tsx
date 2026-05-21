import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAttendanceLogs, getLeaveRequests } from '@/lib/team/queries'
import AttendanceCalendar from '@/components/team/AttendanceCalendar'
import LeaveApplyForm from '@/components/team/LeaveApplyForm'
import AttendancePageClient from '@/components/team/AttendancePageClient'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [logs, leaves] = await Promise.all([
    getAttendanceLogs(user.id, month, year),
    getLeaveRequests(user.id),
  ])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
          <p className="text-sm text-slate-500 mt-1">
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <AttendancePageClient />
      </div>

      <AttendanceCalendar logs={logs} month={month} year={year} />

      {/* Leave history */}
      {leaves.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">Leave Requests</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {leaves.slice(0, 10).map((l) => (
              <div key={l.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800 capitalize">{l.leave_type.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{l.from_date} → {l.to_date} · {l.days_count} day{l.days_count > 1 ? 's' : ''}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  l.status === 'approved' ? 'bg-green-50 text-green-700' :
                  l.status === 'rejected' ? 'bg-red-50 text-red-700' :
                  l.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
