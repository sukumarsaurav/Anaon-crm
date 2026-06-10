'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

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

  const today = new Date().toISOString().split('T')[0]
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

  const today = new Date().toISOString().split('T')[0]
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
  const daysCount = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  )

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

  const { error } = await auth.supabase.from('leave_requests').update({
    status:      approved ? 'approved' : 'rejected',
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    review_note: note ?? null,
    updated_at:  new Date().toISOString(),
  }).eq('id', leaveId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/team/attendance')
  return { success: true }
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
    expires_at: formData.get('expires_at') as string || null,
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

// ── Team Member (admin create/update) ──────────────────────────────────────────

export async function updateMemberProfile(userId: string, formData: FormData) {
  const auth = await requireRole(['admin', 'manager'])
  if (!auth.ok) return { success: false, error: auth.error }

  const updates: Record<string, unknown> = {
    full_name:         formData.get('full_name') as string,
    phone:             formData.get('phone') as string || null,
    designation:       formData.get('designation') as string || null,
    employee_id:       formData.get('employee_id') as string || null,
    joining_date:      formData.get('joining_date') as string || null,
    date_of_birth:     formData.get('date_of_birth') as string || null,
    base_salary:       parseFloat(formData.get('base_salary') as string) || null,
    emergency_contact: formData.get('emergency_contact') as string || null,
    address:           formData.get('address') as string || null,
    updated_at:        new Date().toISOString(),
  }

  // Admin can change role and branch
  if (auth.userId !== userId) {
    const role = formData.get('role') as string
    const branchId = formData.get('branch_id') as string
    if (role) updates.role = role
    if (branchId) updates.branch_id = branchId
  }

  const { error } = await auth.supabase.from('profiles').update(updates).eq('id', userId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/team/${userId}`)
  revalidatePath('/team')
  return { success: true }
}

export async function toggleMemberActive(userId: string, isActive: boolean) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/team')
  return { success: true }
}
