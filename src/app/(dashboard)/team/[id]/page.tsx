import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/supabase/getProfile'
import {
  getMemberProfile, getMonthlyKPI, getMonthlyTarget,
  getDailyKPI, getAttendanceLogs, getLeaveRequests, getIncentiveSlabs,
} from '@/lib/team/queries'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import KPIGrid from '@/components/team/KPIGrid'
import TargetProgressPanel from '@/components/team/TargetProgressPanel'
import IncentiveSlabTracker from '@/components/team/IncentiveSlabTracker'
import AttendanceCalendar from '@/components/team/AttendanceCalendar'
import CheckInWidget from '@/components/team/CheckInWidget'
import LeaveRequestCard from '@/components/team/LeaveRequestCard'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MemberProfilePage({ params }: Props) {
  const { id } = await params
  const user = (await getProfile())?.user
  const currentProfile = (await getProfile())?.profile

  const isOwn = user!.id === id
  const canManage = currentProfile?.role === 'admin' || currentProfile?.role === 'manager'

  if (!isOwn && !canManage) notFound()

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const today = now.toISOString().split('T')[0]

  const [member, kpi, target, todayKPI, attendanceLogs, leaveRequests, slabs] = await Promise.all([
    getMemberProfile(id),
    getMonthlyKPI(id, month, year),
    getMonthlyTarget(id, month, year),
    getDailyKPI(id, today),
    getAttendanceLogs(id, month, year),
    getLeaveRequests(id),
    getIncentiveSlabs(),
  ])

  if (!member) notFound()

  const todayLog = attendanceLogs.find((l) => l.date === today) ?? null
  const initials = getInitials(member.full_name)

  return (
    <div className="p-6 space-y-6">
      {/* Profile header */}
      <Card padding="lg">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl flex-shrink-0">
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.full_name} className="w-16 h-16 rounded-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{member.full_name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                member.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {member.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              {member.designation ?? member.role} {member.branch && `· ${member.branch.name}`}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
              {member.email && <span>{member.email}</span>}
              {member.phone && <span>{member.phone}</span>}
              {member.employee_id && <span>ID: {member.employee_id}</span>}
              {member.joining_date && <span>Joined {formatDate(member.joining_date)}</span>}
              {member.base_salary && <span>{formatCurrency(member.base_salary)}/mo</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {canManage && (
              <Button href={`/team/targets?member=${id}`} variant="secondary" size="sm">
                Set Target
              </Button>
            )}
            <Button href={`/team/${id}/performance`} variant="secondary" size="sm">
              History
            </Button>
          </div>
        </div>
      </Card>

      {/* Check-in + Today KPIs row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          {isOwn && <CheckInWidget todayLog={todayLog} />}
        </div>
        <div className="lg:col-span-2">
          <KPIGrid kpi={todayKPI} label="Today's Activity" />
        </div>
      </div>

      {/* Monthly performance row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TargetProgressPanel target={target} kpi={kpi} />
        </div>
        <div>
          <IncentiveSlabTracker
            slabs={slabs}
            kpi={kpi}
            totalRevenue={kpi.revenue_generated}
          />
        </div>
      </div>

      {/* Attendance */}
      <AttendanceCalendar logs={attendanceLogs} month={month} year={year} />

      {/* Leave requests */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Leave Requests</h3>
          {isOwn && (
            <Link href="/team/attendance" className="text-sm text-indigo-600 hover:underline">
              Apply for leave →
            </Link>
          )}
        </div>
        {leaveRequests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No leave requests</p>
        ) : (
          <div className="space-y-3">
            {leaveRequests.slice(0, 5).map((req) => (
              <LeaveRequestCard
                key={req.id}
                request={req}
                canReview={canManage && !isOwn}
                isOwn={isOwn}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
