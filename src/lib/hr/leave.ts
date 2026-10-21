import type { SupabaseClient } from '@supabase/supabase-js'

const DAY_MS = 86_400_000

/** Calendar dates from `from` to `to` inclusive ("YYYY-MM-DD"), skipping Sundays (the weekly off). */
export function leaveWorkingDates(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  const out: string[] = []
  for (let t = start; t <= end; t += DAY_MS) {
    if (new Date(t).getUTCDay() !== 0) out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/**
 * The one place a leave request is approved or rejected. Two server actions (HR and Team) each
 * had their own copy; neither guarded the current status (a rejected request could be flipped to
 * approved) and approving never touched the balance, so "used" stayed at 0 forever.
 * Plain module — not a server action. The database also refuses a decision on your own request.
 */
export async function decideLeave(
  supabase: SupabaseClient,
  opts: { leaveId: string; reviewerId: string; approve: boolean; note?: string | null },
): Promise<{ success: boolean; error?: string }> {
  const { data: leave } = await supabase
    .from('leave_requests')
    .select('user_id, leave_type, days_count, status, from_date, to_date')
    .eq('id', opts.leaveId)
    .maybeSingle()

  if (!leave) return { success: false, error: 'Leave request not found, or not in your team' }
  if (leave.status !== 'pending') return { success: false, error: `This request is already ${leave.status}` }
  if (leave.user_id === opts.reviewerId) return { success: false, error: 'You cannot review your own leave request' }

  const { data: updated, error } = await supabase
    .from('leave_requests')
    .update({
      status: opts.approve ? 'approved' : 'rejected',
      reviewed_by: opts.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: opts.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.leaveId)
    .eq('status', 'pending') // two reviewers clicking at once: only the first wins
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!updated?.length) return { success: false, error: 'This request was already reviewed' }
  if (!opts.approve) return { success: true }

  // Balance: counted against the year the leave starts in.
  const year = Number(String(leave.from_date).slice(0, 4)) || new Date().getFullYear()
  const days = Number(leave.days_count ?? 0)
  const { data: balance } = await supabase
    .from('hr_leave_balances')
    .select('id, used')
    .eq('user_id', leave.user_id)
    .eq('year', year)
    .eq('leave_type', leave.leave_type)
    .maybeSingle()
  const { error: balError } = balance
    ? await supabase.from('hr_leave_balances').update({ used: Number(balance.used ?? 0) + days, updated_at: new Date().toISOString() }).eq('id', balance.id)
    : await supabase.from('hr_leave_balances').insert({ user_id: leave.user_id, year, leave_type: leave.leave_type, entitled: 0, used: days })
  if (balError) console.error('[leave] balance update failed:', balError.message)

  // Show the days as "On leave" on the attendance calendar and HR register. A day the person
  // actually checked in on keeps its check-in.
  const dates = leaveWorkingDates(leave.from_date, leave.to_date)
  if (dates.length) {
    const { data: existing } = await supabase
      .from('attendance_logs').select('date, check_in_at').eq('user_id', leave.user_id).in('date', dates)
    const byDate = new Map((existing ?? []).map((r) => [r.date as string, r.check_in_at as string | null]))
    const now = new Date().toISOString()
    const fresh = dates.filter((d) => !byDate.has(d)).map((date) => ({ user_id: leave.user_id, date, status: 'on_leave', updated_at: now }))
    const toMark = dates.filter((d) => byDate.has(d) && !byDate.get(d))
    if (fresh.length) {
      const { error: insErr } = await supabase.from('attendance_logs').insert(fresh)
      if (insErr) console.error('[leave] attendance insert failed:', insErr.message)
    }
    if (toMark.length) {
      const { error: updErr } = await supabase.from('attendance_logs')
        .update({ status: 'on_leave', updated_at: now }).eq('user_id', leave.user_id).in('date', toMark).is('check_in_at', null)
      if (updErr) console.error('[leave] attendance update failed:', updErr.message)
    }
  }
  return { success: true }
}
