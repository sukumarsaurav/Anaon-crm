'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { writeAuditLog } from '@/lib/security/audit'
import { slabProblem, type SlabDraft } from './commission'

/**
 * Save the whole slab table at once (admin only; RLS too), so it is never half-valid between edits.
 * Slabs only drive projections and the incentive pre-filled on new payslips — a finalized slip keeps
 * the amount it was paid with.
 */
export async function saveIncentiveSlabs(input: SlabDraft[]): Promise<{ success: boolean; error?: string }> {
  const session = await getProfile()
  if (session?.profile?.role !== 'admin') return { success: false, error: 'Only an admin can change incentive slabs' }

  const slabs: SlabDraft[] = (input ?? []).map((s) => ({
    id: s.id,
    label: String(s.label ?? '').trim(),
    from_bookings: Number(s.from_bookings),
    to_bookings: s.to_bookings === null || (s.to_bookings as unknown) === '' ? null : Number(s.to_bookings),
    commission_percent: Number(s.commission_percent),
    bonus_amount: Number(s.bonus_amount ?? 0),
    is_active: !!s.is_active,
  }))
  const problem = slabProblem(slabs)
  if (problem) return { success: false, error: problem }

  const supabase = await createClient()
  const { data: before } = await supabase.from('incentive_slabs').select('*').order('sort_order')
  const ordered = [...slabs].sort((a, b) => a.from_bookings - b.from_bookings)
  const keep = new Set(ordered.map((s) => s.id).filter(Boolean) as string[])

  for (const [i, s] of ordered.entries()) {
    const row = { label: s.label, from_bookings: s.from_bookings, to_bookings: s.to_bookings, commission_percent: s.commission_percent,
      bonus_amount: s.bonus_amount, is_active: s.is_active, sort_order: i + 1 }
    const { error } = s.id
      ? await supabase.from('incentive_slabs').update(row).eq('id', s.id)
      : await supabase.from('incentive_slabs').insert(row)
    if (error) return { success: false, error: error.message }
  }
  const removed = (before ?? []).filter((b) => !keep.has(b.id)).map((b) => b.id)
  if (removed.length) {
    const { error } = await supabase.from('incentive_slabs').delete().in('id', removed)
    if (error) return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: session.user.id, action: 'incentive_slabs_updated', tableName: 'incentive_slabs',
    oldValues: { slabs: before ?? [] }, newValues: { slabs: ordered },
  })
  revalidatePath('/team/incentives')
  revalidatePath('/team', 'layout')
  return { success: true }
}
