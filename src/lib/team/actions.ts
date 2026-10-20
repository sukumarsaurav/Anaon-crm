'use server'

import { revalidatePath } from 'next/cache'
import { updateStaffProfile, changeStaffAssignment, setStaffActive } from './staff'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { istToIso, todayIST } from '@/lib/datetime'
import { decideLeave } from '@/lib/hr/leave'

async function requireRole(roles: string[]) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, error: 'Unauthorized', supabase, userId: '' }
  const profile = (await getProfile())?.profile
  if (!profile || !roles.includes(profile.role)) return { ok: false as const, error: 'Forbidden', supabase, userId: user.id }
  return { ok: true as const, supabase, userId: user.id }
}

// ── Targets ──────────────────────────────────────────────────────────────────

export async function setMonthlyTarget(formData: FormData) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const userId    = formData.get('user_id') as string
  const month     = parseInt(formData.get('month') as string, 10)
  const year      = parseInt(formData.get('year') as string, 10)

  const { error } = await auth.supabase.from('team_targets').upsert({
    user_id:             userId,
    month,
    year,
    target_revenue:      parseFloat(formData.get('target_revenue') as string) || 0,
    target_bookings:     parseInt(formData.get('target_bookings') as string, 10) || 0,
    target_site_visits:  parseInt(formData.get('target_site_visits') as string, 10) || 0,
    target_calls:        parseInt(formData.get('target_calls') as string, 10) || 0,
    created_by:          auth.userId,
    updated_at:          new Date().toISOString(),
  }, { onConflict: 'user_id,month,year' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/targets')
  revalidatePath('/team')
  return { success: true }
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function checkIn(lat?: number, lng?: number) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const today = todayIST()
  const now   = new Date().toISOString()

  const { error } = await supabase.from('attendance_logs').upsert({
    user_id:       user.id,
    date:          today,
    check_in_at:   now,
    check_in_lat:  lat ?? null,
    check_in_lng:  lng ?? null,
    status:        'present',
    updated_at:    now,
  }, { onConflict: 'user_id,date' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  return { success: true }
}

export async function checkOut(lat?: number, lng?: number) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const today = todayIST()
  const now   = new Date().toISOString()

  const { error } = await supabase
    .from('attendance_logs')
    .update({
      check_out_at:  now,
      check_out_lat: lat ?? null,
      check_out_lng: lng ?? null,
      updated_at:    now,
    })
    .eq('user_id', user.id)
    .eq('date', today)

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  return { success: true }
}

export async function markAttendance(userId: string, date: string, status: string, notes?: string) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const { error } = await auth.supabase.from('attendance_logs').upsert({
    user_id: userId,
    date,
    status,
    notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  return { success: true }
}

// ── Leave ─────────────────────────────────────────────────────────────────────

export async function applyLeave(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const fromDate = new Date(formData.get('from_date') as string)
  const toDate   = new Date(formData.get('to_date') as string)
  // An empty or reversed range used to be saved (as 1 day, or NaN and a database error).
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return { success: false, error: 'Choose the first and last day of leave' }
  if (toDate < fromDate) return { success: false, error: 'The last day cannot be before the first day' }
  const daysCount = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const { error } = await supabase.from('leave_requests').insert({
    user_id:    user.id,
    leave_type: formData.get('leave_type') as string,
    from_date:  formData.get('from_date') as string,
    to_date:    formData.get('to_date') as string,
    days_count: daysCount,
    reason:     formData.get('reason') as string || null,
    status:     'pending',
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  return { success: true }
}

export async function reviewLeave(leaveId: string, approved: boolean, note?: string) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const r = await decideLeave(auth.supabase, { leaveId, reviewerId: auth.userId, approve: approved, note })
  if (r.success) revalidatePath('/team/attendance')
  return r
}

export async function cancelLeave(leaveId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('leave_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', leaveId)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  return { success: true }
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function createAnnouncement(formData: FormData) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const { error } = await auth.supabase.from('announcements').insert({
    title:      formData.get('title') as string,
    body:       formData.get('body') as string,
    type:       (formData.get('type') as string) || 'announcement',
    is_pinned:  formData.get('is_pinned') === 'true',
    branch_id:  formData.get('branch_id') as string || null,
    author_id:  auth.userId,
    expires_at: istToIso(formData.get('expires_at') as string),
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/announcements')
  revalidatePath('/team')
  return { success: true }
}

export async function pinAnnouncement(id: string, pinned: boolean) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from('announcements')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/announcements')
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return { success: false, error: auth.error }

  const { error } = await auth.supabase.from('announcements').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team/announcements')
  return { success: true }
}

// ── Team Member ───────────────────────────────────────────────────────────────
// Writes to someone else's profile go through lib/team/staff.ts (service role, caller checked).

export async function updateMemberProfile(userId: string, formData: FormData) {
  const res = await updateStaffProfile(userId, formData)
  if (!res.success) return res
  const role = formData.get('role') as string | null
  const branchId = formData.get('branch_id') as string | null
  if (role || branchId) return changeStaffAssignment(userId, { role: role || undefined, branch_id: branchId || undefined })
  return res
}

export async function toggleMemberActive(userId: string, isActive: boolean) {
  return setStaffActive(userId, isActive)
}
