import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The one place a leave request is approved or rejected. Two server actions (HR and Team) each
 * had their own copy; neither guarded the current status (a rejected request could be flipped to
 * approved) and approving never touched the balance, so "used" stayed at 0 forever.
 * Plain module — not a server action.
 */
export async function decideLeave(
  supabase: SupabaseClient,
  opts: { leaveId: string; reviewerId: string; approve: boolean; note?: string | null },
): Promise<{ success: boolean; error?: string }> {
  const { data: leave } = await supabase
    .from('leave_requests')
    .select('user_id, leave_type, days_count, status, from_date')
    .eq('id', opts.leaveId)
    .single()

  if (!leave) return { success: false, error: 'Leave request not found' }
  if (leave.status !== 'pending') return { success: false, error: `This request is already ${leave.status}` }
  if (leave.user_id === opts.reviewerId) return { success: false, error: 'You cannot review your own leave request' }

  const { error } = await supabase
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
  if (error) return { success: false, error: error.message }

  if (opts.approve) {
    const year = new Date(leave.from_date ?? Date.now()).getFullYear()
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
  }
  return { success: true }
}
