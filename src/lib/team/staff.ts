'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getProfile } from '@/lib/supabase/getProfile'
import { writeAuditLog } from '@/lib/security/audit'
import { encryptPii } from '@/lib/security/pii'
import { todayIST } from '@/lib/datetime'

/**
 * Every change to another staff member's profile goes through here.
 *
 * `profiles` only lets a user update their own row, so the HR and Team screens that used the
 * signed-in client changed nothing and still reported success: an admin could not edit, deactivate
 * or reactivate anyone. These actions check the caller, then write with the service role.
 *
 * Rules: an admin may manage anyone. A manager may manage staff in their own hierarchy (the people
 * RLS lets them see), never an admin, and may not change roles. Nobody deactivates themselves.
 */

type Result = { success: boolean; error?: string }

const STAFF_ROLES = ['admin', 'manager', 'sales_advisor', 'telecaller'] as const
type StaffRole = (typeof STAFF_ROLES)[number]

async function authorize(targetId: string): Promise<
  | { ok: true; actorId: string; actorRole: StaffRole; target: { id: string; role: string; full_name: string; is_active: boolean } }
  | { ok: false; error: string }
> {
  const session = await getProfile()
  if (!session?.user) return { ok: false, error: 'Not authenticated' }
  const actorRole = session.profile?.role as StaffRole | undefined
  if (actorRole !== 'admin' && actorRole !== 'manager') return { ok: false, error: 'Only admins and managers can do this' }

  // The caller's own client: a manager only "finds" people inside their hierarchy.
  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles').select('id, role, full_name, is_active').eq('id', targetId).maybeSingle()
  if (!target) return { ok: false, error: 'Employee not found, or not in your team' }
  if (actorRole === 'manager' && target.role === 'admin') return { ok: false, error: 'Only an admin can manage an admin account' }
  if (target.role === 'broker') return { ok: false, error: 'Broker accounts are managed from Brokers' }

  return { ok: true, actorId: session.user.id, actorRole, target }
}

function text(fd: FormData, key: string): string | null | undefined {
  if (!fd.has(key)) return undefined // not on this form: leave the column alone
  const v = (fd.get(key) as string | null)?.trim()
  return v ? v : null
}

function revalidateStaff(id: string) {
  revalidatePath('/hr/employees')
  revalidatePath(`/hr/employees/${id}`)
  revalidatePath('/team')
  revalidatePath(`/team/${id}`)
  revalidatePath('/team/teams')
}

/** Profile / HR fields. Only the fields present in the form are written. */
export async function updateStaffProfile(targetId: string, formData: FormData): Promise<Result> {
  const auth = await authorize(targetId)
  if (!auth.ok) return { success: false, error: auth.error }

  const updates: Record<string, unknown> = {}
  for (const key of [
    'full_name', 'phone', 'email', 'designation', 'department', 'employment_type', 'employee_id',
    'joining_date', 'probation_end_date', 'date_of_birth', 'reporting_manager_id',
    'bank_name', 'bank_ifsc', 'emergency_contact', 'address',
  ]) {
    const v = text(formData, key)
    if (v !== undefined) updates[key] = v
  }
  if (updates.full_name === null) return { success: false, error: 'Name is required' }
  if (formData.has('base_salary')) {
    const n = parseFloat(formData.get('base_salary') as string)
    updates.base_salary = Number.isFinite(n) && n >= 0 ? n : null
  }
  if (updates.reporting_manager_id === targetId) return { success: false, error: 'Someone cannot report to themselves' }

  // Government IDs and the bank account are stored encrypted, like client PAN / Aadhaar.
  try {
    for (const key of ['aadhar_number', 'pan_number', 'bank_account']) {
      const v = text(formData, key)
      if (v !== undefined) updates[key] = encryptPii(v)
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }

  if (!Object.keys(updates).length) return { success: true }
  updates.updated_at = new Date().toISOString()

  const { error } = await createServiceClient().from('profiles').update(updates).eq('id', targetId)
  if (error) return { success: false, error: error.message }

  const logged = { ...updates }
  for (const k of ['aadhar_number', 'pan_number', 'bank_account']) if (k in logged) logged[k] = '[encrypted]'
  await writeAuditLog({ userId: auth.actorId, action: 'user_updated', tableName: 'profiles', recordId: targetId, newValues: logged })
  revalidateStaff(targetId)
  return { success: true }
}

/** Role, branch and team. Admin only. */
export async function changeStaffAssignment(
  targetId: string,
  input: { role?: string; branch_id?: string | null; team_id?: string | null },
): Promise<Result> {
  if ((await getProfile())?.profile?.role !== 'admin') return { success: false, error: 'Only admins can change roles, branches or teams' }
  const auth = await authorize(targetId)
  if (!auth.ok) return { success: false, error: auth.error }

  const updates: Record<string, unknown> = {}
  if (input.role !== undefined) {
    if (!STAFF_ROLES.includes(input.role as StaffRole)) return { success: false, error: 'Unknown role' }
    if (targetId === auth.actorId && input.role !== 'admin') {
      return { success: false, error: 'You cannot remove your own admin role' }
    }
    updates.role = input.role
  }
  if (input.branch_id !== undefined) updates.branch_id = input.branch_id || null
  if (input.team_id !== undefined) updates.team_id = input.team_id || null
  if (!Object.keys(updates).length) return { success: true }
  updates.updated_at = new Date().toISOString()

  const svc = createServiceClient()
  const { error } = await svc.from('profiles').update(updates).eq('id', targetId)
  if (error) return { success: false, error: error.message }
  // The role also lives in app_metadata, which the login route and handle_new_user read.
  if (updates.role) await svc.auth.admin.updateUserById(targetId, { app_metadata: { role: updates.role } })

  await writeAuditLog({
    userId: auth.actorId, action: updates.role && updates.role !== auth.target.role ? 'role_changed' : 'user_updated',
    tableName: 'profiles', recordId: targetId, oldValues: { role: auth.target.role }, newValues: updates,
  })
  revalidateStaff(targetId)
  return { success: true }
}

/**
 * Deactivate or reactivate a login. Deactivating also bans the auth user, which ends their sessions
 * at the next token refresh and blocks sign-in at Supabase itself, not only in our login route.
 */
export async function setStaffActive(targetId: string, active: boolean, reason?: string): Promise<Result> {
  const auth = await authorize(targetId)
  if (!auth.ok) return { success: false, error: auth.error }
  if (!active && targetId === auth.actorId) return { success: false, error: 'You cannot deactivate your own account' }
  if (auth.target.is_active === active) return { success: true }

  const svc = createServiceClient()
  const updates: Record<string, unknown> = { is_active: active, updated_at: new Date().toISOString() }
  if (!active) {
    updates.termination_date = todayIST()
    updates.termination_reason = reason?.trim() || null
  } else {
    updates.termination_date = null
    updates.termination_reason = null
    updates.failed_login_count = 0
    updates.lockout_until = null
  }
  const { error } = await svc.from('profiles').update(updates).eq('id', targetId)
  if (error) return { success: false, error: error.message }

  const { error: banErr } = await svc.auth.admin.updateUserById(targetId, { ban_duration: active ? 'none' : '876000h' })
  if (banErr) console.error('[staff] auth ban update failed:', banErr.message)
  if (!active) {
    await svc.from('user_sessions')
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: auth.actorId })
      .eq('user_id', targetId).eq('is_active', true)
  }

  await writeAuditLog({
    userId: auth.actorId, action: active ? 'user_updated' : 'user_deactivated', tableName: 'profiles', recordId: targetId,
    oldValues: { is_active: !active }, newValues: { is_active: active, reason: reason ?? null },
  })
  revalidateStaff(targetId)
  return { success: true }
}
