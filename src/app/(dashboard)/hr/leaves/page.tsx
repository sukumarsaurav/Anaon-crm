export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getLeaveRequests } from '@/lib/hr/queries'
import { LEAVE_TYPES } from '@/types/hr'
import { formatDate } from '@/lib/utils'
import LeaveReviewActions from '@/components/hr/LeaveReviewActions'
import { ArrowLeft, Calendar } from 'lucide-react'

export default async function LeavesPage() {
  const [pending, all] = await Promise.all([
    getLeaveRequests('pending'),
    getLeaveRequests(),
  ])

  const recent = all.filter(l => l.status !== 'pending').slice(0, 30)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leave Requests</h1>
          <p className="text-sm text-slate-500">{pending.length} pending approval</p>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
            <h2 className="font-semibold text-amber-800 text-sm">Pending Approval ({pending.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map(req => {
              const typeLabel = LEAVE_TYPES.find(t => t.value === req.leave_type)?.label ?? req.leave_type
              return (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-slate-900 text-sm">
                          {req.employee?.full_name ?? 'Unknown'}
                        </p>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium">
                          {typeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {req.employee?.designation}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar size={12} />
                        <span>{formatDate(req.from_date)} → {formatDate(req.to_date)}</span>
                        <span className="font-semibold text-slate-700">· {req.days_count} day{req.days_count > 1 ? 's' : ''}</span>
                      </div>
                      {req.reason && <p className="text-xs text-slate-400 mt-1 italic">{req.reason}</p>}
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{formatDate(req.created_at)}</p>
                  </div>
                  <LeaveReviewActions leaveId={req.id} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent reviewed */}
      {recent.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Recent</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.map(req => {
              const typeLabel = LEAVE_TYPES.find(t => t.value === req.leave_type)?.label ?? req.leave_type
              return (
                <div key={req.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{req.employee?.full_name}</p>
                    <p className="text-xs text-slate-400">
                      {typeLabel} · {formatDate(req.from_date)} – {formatDate(req.to_date)} · {req.days_count}d
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    req.status === 'approved' ? 'bg-green-50 text-green-700' :
                    req.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {req.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pending.length === 0 && recent.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
          No leave requests yet.
        </div>
      )}
    </div>
  )
}
