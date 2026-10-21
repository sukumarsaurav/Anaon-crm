'use server'

import { revalidatePath } from 'next/cache'
import { updateStaffProfile, changeStaffAssignment, setStaffActive } from './staff'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { istToIso, todayIST } from '@/lib/datetime'
import { decideLeave, leaveWorkingDates } from '@/lib/hr/leave'
import { LEAVE_TYPE_LABELS, ATTENDANCE_STATUS_CONFIG } from '@/types/team'

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
  if (!userId) return { success: false, error: 'Choose a team member' }
  if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) return { success: false, error: 'Choose a valid month and year' }
  if (userId === auth.userId) return { success: false, error: 'Your own target is set by your manager' }

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

  // RLS: managers set targets only for the people in the teams they lead.
  if (error) return { success: false, error: /row-level security/i.test(error.message) ? 'You can only set targets for your own team' : error.message }
  revalidatePath('/team/targets')
  revalidatePath('/team')
  return { success: true }
}

// ── Attendance ────────────────────────────────────────────────────────────────

/**
 * Web check-in. It used to upsert, so a second click (another tab, or after the mobile app) moved the
 * check-in time, and it overwrote a day a manager had marked "on leave" with "present".
 */
export async function checkIn(lat?: number, lng?: number) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const today = todayIST()
  const now   = new Date().toISOString()
  const { data: existing } = await supabase
    .from('attendance_logs').select('id, check_in_at, status').eq('user_id', user.id).eq('date', today).maybeSingle()
  if (existing?.check_in_at) return { success: false, error: 'You have already checked in today' }
  if (existing && existing.status !== 'present') {
    return { success: false, error: `Today is marked "${ATTENDANCE_STATUS_CONFIG[existing.status as keyof typeof ATTENDANCE_STATUS_CONFIG]?.label ?? existing.status}". Ask your manager to change it.` }
  }

  const location = { check_in_at: now, check_in_lat: lat ?? null, check_in_lng: lng ?? null, updated_at: now }
  const { error } = existing
    ? await supabase.from('attendance_logs').update(location).eq('id', existing.id)
    : await supabase.from('attendance_logs').insert({ user_id: user.id, date: today, status: 'present', ...location })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  revalidatePath(`/team/${user.id}`)
  return { success: true }
}

export async function checkOut(lat?: number, lng?: number) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const today = todayIST()
  const now   = new Date().toISOString()

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({
      check_out_at:  now,
      check_out_lat: lat ?? null,
      check_out_lng: lng ?? null,
      updated_at:    now,
    })
    .eq('user_id', user.id)
    .eq('date', today)
    .not('check_in_at', 'is', null)
    .is('check_out_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'No open check-in for today' }
  revalidatePath('/team/attendance')
  revalidatePath(`/team/${user.id}`)
  return { success: true }
}

export async function markAttendance(userId: string, date: string, status: string, notes?: string) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }
  if (!(status in ATTENDANCE_STATUS_CONFIG)) return { success: false, error: 'Choose a status' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIST()) return { success: false, error: 'Choose today or an earlier date' }

  const { error } = await auth.supabase.from('attendance_logs').upsert({
    user_id: userId,
    date,
    status,
    notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' })

  if (error) return { success: false, error: /row-level security/i.test(error.message) ? 'You can only correct attendance for your own team' : error.message }
  revalidatePath('/team/attendance')
  revalidatePath('/hr/attendance')
  return { success: true }
}

// ── Leave ─────────────────────────────────────────────────────────────────────

export async function applyLeave(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const leaveType = formData.get('leave_type') as string
  const from = (formData.get('from_date') as string) || ''
  const to   = (formData.get('to_date') as string) || ''
  if (!(leaveType in LEAVE_TYPE_LABELS)) return { success: false, error: 'Choose a leave type' }
  // An empty or reversed range used to be saved (as 1 day, or NaN and a database error).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'Choose the first and last day of leave' }
  if (to < from) return { success: false, error: 'The last day cannot be before the first day' }
  // Sundays are the weekly off and don't use leave (payroll counts working days the same way).
  const daysCount = leaveWorkingDates(from, to).length
  if (daysCount === 0) return { success: false, error: 'Those dates are all Sundays — no leave is needed' }

  const { data: overlapping } = await supabase
    .from('leave_requests').select('id')
    .eq('user_id', user.id).in('status', ['pending', 'approved'])
    .lte('from_date', to).gte('to_date', from).limit(1)
  if (overlapping?.length) return { success: false, error: 'You already have leave requested for some of these days' }

  const { error } = await supabase.from('leave_requests').insert({
    user_id:    user.id,
    leave_type: leaveType,
    from_date:  from,
    to_date:    to,
    days_count: daysCount,
    reason:     formData.get('reason') as string || null,
    status:     'pending',
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  revalidatePath('/hr/leaves')
  return { success: true }
}

export async function reviewLeave(leaveId: string, approved: boolean, note?: string) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const r = await decideLeave(auth.supabase, { leaveId, reviewerId: auth.userId, approve: approved, note })
  if (r.success) { revalidatePath('/team/attendance'); revalidatePath('/hr/leaves'); revalidatePath('/team', 'layout') }
  return r
}

export async function cancelLeave(leaveId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', leaveId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Only a pending request can be withdrawn' }
  revalidatePath('/team/attendance')
  return { success: true }
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function createAnnouncement(formData: FormData) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }
  if (!(formData.get('title') as string)?.trim() || !(formData.get('body') as string)?.trim()) {
    return { success: false, error: 'Write a title and a message' }
  }

  const { error } = await auth.supabase.from('announcements').insert({
    title:      (formData.get('title') as string).trim(),
    body:       (formData.get('body') as string).trim(),
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

  const { data, error } = await auth.supabase
    .from('announcements')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Announcement not found' }
  revalidatePath('/team/announcements')
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  // RLS: the author or an admin.
  const { data, error } = await auth.supabase.from('announcements').delete().eq('id', id).select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Only the author or an admin can delete this announcement' }
  revalidatePath('/team/announcements')
  return { success: true }
}

// ── Team Member ───────────────────────────────────────────────────────────────
// Writes to someone else's profile go through lib/team/staff.ts (service role, caller checked).

export async function updateMemberProfile(userId: string, formData: FormData) {
  const role = formData.get('role') as string | null
  const branchId = formData.get('branch_id') as string | null
  // Check the assignment part first: it is admin-only, and the profile half used to be saved before
  // the role change was refused.
  if ((role || branchId) && (await getProfile())?.profile?.role !== 'admin') {
    return { success: false, error: 'Only admins can change roles or branches' }
  }
  const res = await updateStaffProfile(userId, formData)
  if (!res.success) return res
  if (role || branchId) return changeStaffAssignment(userId, { role: role || undefined, branch_id: branchId || undefined })
  return res
}

export async function toggleMemberActive(userId: string, isActive: boolean) {
  return setStaffActive(userId, isActive)
}
