'use client'

import { useTransition } from 'react'
import { formatDate } from '@/lib/utils'
import { reviewLeave, cancelLeave } from '@/lib/team/actions'
import { LEAVE_TYPE_LABELS } from '@/types/team'
import type { LeaveRequest } from '@/types/team'

interface Props {
  request: LeaveRequest
  canReview?: boolean
  isOwn?: boolean
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  approved:  { label: 'Approved',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  rejected:  { label: 'Rejected',  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
}

export default function LeaveRequestCard({ request, canReview, isOwn }: Props) {
  const [isPending, startTransition] = useTransition()
  const cfg = STATUS_CONFIG[request.status]

  function handleReview(approved: boolean) {
    startTransition(async () => {
      await reviewLeave(request.id, approved)
    })
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelLeave(request.id)
    })
  }

  return (
    <div className={`border rounded-xl p-4 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Member name (for manager view) */}
          {request.member && (
            <p className="text-sm font-semibold text-slate-900 mb-1">{request.member.full_name}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800">
              {LEAVE_TYPE_LABELS[request.leave_type]}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-sm text-slate-600">
              {formatDate(request.from_date)}
              {request.from_date !== request.to_date && ` → ${formatDate(request.to_date)}`}
            </span>
            <span className="text-xs text-slate-500">({request.days_count} day{request.days_count > 1 ? 's' : ''})</span>
          </div>
          {request.reason && (
            <p className="text-xs text-slate-500 mt-1">{request.reason}</p>
          )}
          {request.review_note && (
            <p className="text-xs text-slate-500 mt-1 italic">
              Review note: {request.review_note}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>

      {/* Actions */}
      {request.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          {canReview && (
            <>
              <button
                onClick={() => handleReview(true)}
                disabled={isPending}
                className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 font-medium"
              >
                Approve
              </button>
              <button
                onClick={() => handleReview(false)}
                disabled={isPending}
                className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-40 font-medium"
              >
                Reject
              </button>
            </>
          )}
          {isOwn && (
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-40 font-medium"
            >
              Cancel Request
            </button>
          )}
        </div>
      )}
    </div>
  )
}
