import { redirect } from 'next/navigation'
import Link from 'next/link'
import { istMonthYear, todayIST } from '@/lib/datetime'
import { getProfile } from '@/lib/supabase/getProfile'
import { createClient } from '@/lib/supabase/server'
import { getAttendanceLogs, getLeaveRequests } from '@/lib/team/queries'
import AttendanceCalendar from '@/components/team/AttendanceCalendar'
import AttendancePageClient from '@/components/team/AttendancePageClient'
import CheckInWidget from '@/components/team/CheckInWidget'
import LeaveRequestCard from '@/components/team/LeaveRequestCard'
import { formatCurrency } from '@/lib/utils'
import { MONTH_NAMES } from '@/types/hr'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const metadata = { title: 'My Attendance' }

export const dynamic = 'force-dynamic'

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const user = (await getProfile())?.user
  if (!user) redirect('/login')

  const current = istMonthYear()
  const sp = await searchParams
  const m = parseInt(sp.month ?? '', 10), y = parseInt(sp.year ?? '', 10)
  const month = m >= 1 && m <= 12 ? m : current.month
  const year = y >= 2020 && y <= 2100 ? y : current.year
  const isCurrent = month === current.month && year === current.year
  const prev = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year }
  const next = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }

  const supabase = await createClient()
  const [logs, leaves, todayLogs, slipsRes] = await Promise.all([
    getAttendanceLogs(user.id, month, year),
    getLeaveRequests(user.id),
    isCurrent ? Promise.resolve(null) : getAttendanceLogs(user.id, current.month, current.year),
    // Visible once the run is finalized (RLS).
    supabase.from('payroll_slips')
      .select('id, working_days, present_days, lop_days, gross, incentives, total_deductions, net_pay, run:payroll_runs!payroll_slips_run_id_fkey(year, month)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
  ])
  const today = todayIST()
  const todayLog = (todayLogs ?? logs).find((l) => l.date === today) ?? null
  const slips = (slipsRes.data ?? []).map((s) => ({ ...s, run: Array.isArray(s.run) ? s.run[0] : s.run })) as
    { id: string; working_days: number; present_days: number; lop_days: number; gross: number; incentives: number; total_deductions: number; net_pay: number; run: { year: number; month: number } | null }[]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
          <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
            <Link href={`/team/attendance?month=${prev.month}&year=${prev.year}`} aria-label="Previous month" className="p-1 rounded-lg hover:bg-slate-100"><ChevronLeft size={16} /></Link>
            <span>{MONTH_NAMES[month]} {year}</span>
            {!isCurrent && (
              <Link href={`/team/attendance?month=${next.month}&year=${next.year}`} aria-label="Next month" className="p-1 rounded-lg hover:bg-slate-100"><ChevronRight size={16} /></Link>
            )}
          </div>
        </div>
        <AttendancePageClient />
      </div>

      <CheckInWidget todayLog={todayLog} />

      <AttendanceCalendar logs={logs} month={month} year={year} />

      {leaves.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-900 text-sm">Leave Requests</h3>
          {leaves.slice(0, 10).map((l) => <LeaveRequestCard key={l.id} request={l} isOwn />)}
        </div>
      )}

      {slips.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm">My Payslips</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th scope="col" className="px-4 py-2.5 text-left">Month</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Paid days</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Gross</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Deductions</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Net pay</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Payslip</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-slate-900">{s.run ? `${MONTH_NAMES[s.run.month]} ${s.run.year}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{s.present_days}/{s.working_days}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(s.gross, { mode: 'exact' })}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(s.total_deductions, { mode: 'exact' })}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(s.net_pay, { mode: 'exact' })}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/api/documents/payslip/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
