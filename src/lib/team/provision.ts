import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/security/audit'
import { MUST_CHANGE_PASSWORD } from '@/lib/security/passwordPolicy'
import type { AddJuniorInput } from '@/types/team'

/**
 * Creating a staff login, shared by Team → Add junior and HR → candidate "Joined". Plain module (not a
 * server action): callers check who is asking and pass in what that person may do.
 *
 * Steps: auth user (with a temporary password that must be changed at first sign-in) → optional junior
 * team led by them → profile (team, reporting manager, branch, HR fields). Any failure undoes the
 * earlier steps, so a half-made account never stays behind.
 */

export interface StaffAccountInput extends AddJuniorInput {
  joining_date?: string | null
  base_salary?: number | null
  employee_id?: string | null
  department?: string | null
  employment_type?: string | null
}

export interface Actor {
  id: string
  role: string
  manageableTeamIds: string[]
}

const RANK: Record<string, number> = { telecaller: 1, sales_advisor: 2, manager: 3, admin: 4 }

export function tempPassword(): string {
  return 'Anon-' + randomBytes(4).toString('hex') + '@' + new Date().getFullYear()
}

/** Next free "EMP-0001"-style id. */
export async function nextEmployeeId(): Promise<string> {
  const { data } = await createServiceClient().from('profiles').select('employee_id').like('employee_id', 'EMP-%')
  const max = (data ?? []).reduce((m, r) => Math.max(m, Number(/^EMP-(\d+)$/.exec(String(r.employee_id))?.[1] ?? 0)), 0)
  return `EMP-${String(max + 1).padStart(4, '0')}`
}

export async function createStaffAccount(
  actor: Actor,
  input: StaffAccountInput,
): Promise<{ success: boolean; error?: string; tempPassword?: string; userId?: string }> {
  if (!actor.manageableTeamIds.includes(input.target_team_id)) {
    return { success: false, error: 'You can only add members within your own teams.' }
  }
  const fullName = input.full_name?.trim()
  const email = input.email?.trim().toLowerCase()
  if (!fullName || !email) return { success: false, error: 'Name and email are required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'Enter a valid email' }
  // The role comes from the browser. Allowed: staff roles below admin, never above the caller's own.
  if (!['manager', 'sales_advisor', 'telecaller'].includes(input.role) || RANK[input.role] > (RANK[actor.role] ?? 0)) {
    return { success: false, error: 'You cannot create an account with that role' }
  }
  if (input.base_salary != null && !(Number.isFinite(input.base_salary) && input.base_salary >= 0)) {
    return { success: false, error: 'Enter a valid salary' }
  }

  const svc = createServiceClient()
  const { data: targetTeam } = await svc.from('teams').select('id, leader_id, branch_id').eq('id', input.target_team_id).maybeSingle()
  if (!targetTeam) return { success: false, error: 'Target team not found' }

  const password = tempPassword()
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: input.role, [MUST_CHANGE_PASSWORD]: true }, // replaced on first sign-in
  })
  if (createErr || !created?.user) {
    const exists = /already|registered|exists/i.test(createErr?.message ?? '')
    return { success: false, error: exists ? 'That email already has a CRM login.' : (createErr?.message ?? 'Could not create user') }
  }
  const userId = created.user.id

  let createdTeamId: string | null = null
  if (input.mode === 'team') {
    const { data: newTeam, error: teamErr } = await svc.from('teams').insert({
      name: input.new_team_name?.trim() || `${fullName}'s Team`,
      leader_id: userId,
      parent_team_id: input.target_team_id,
      branch_id: targetTeam.branch_id,
    }).select('id').single()
    if (teamErr) {
      await svc.auth.admin.deleteUser(userId)
      return { success: false, error: teamErr.message }
    }
    createdTeamId = newTeam?.id ?? null
  }

  // The new person is a member of the target team (a new leader too, so the parent leader sees them).
  const profile: Record<string, unknown> = {
    full_name: fullName,
    email,
    phone: input.phone?.trim() || null,
    role: input.role,
    designation: input.designation?.trim() || null,
    team_id: input.target_team_id,
    reporting_manager_id: targetTeam.leader_id,
    branch_id: targetTeam.branch_id,
    is_active: true,
  }
  if (input.joining_date) profile.joining_date = input.joining_date
  if (input.base_salary != null) profile.base_salary = input.base_salary
  if (input.department?.trim()) profile.department = input.department.trim()
  if (input.employment_type) profile.employment_type = input.employment_type
  if (input.employee_id !== undefined) profile.employee_id = input.employee_id?.trim() || null

  const { error: profErr } = await svc.from('profiles').update(profile).eq('id', userId)
  if (profErr) {
    if (createdTeamId) await svc.from('teams').delete().eq('id', createdTeamId)
    await svc.auth.admin.deleteUser(userId)
    return { success: false, error: profErr.message }
  }

  await writeAuditLog({
    userId: actor.id, action: 'user_created', tableName: 'profiles', recordId: userId,
    newValues: { full_name: fullName, email, role: input.role, team_id: input.target_team_id },
  })
  return { success: true, tempPassword: password, userId }
}
