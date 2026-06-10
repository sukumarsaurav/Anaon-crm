'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getProfile } from '@/lib/supabase/getProfile'
import type { TeamRow, MemberRow, TeamsData, AddJuniorInput } from '@/types/team'

/** Load teams + members scoped for the org-chain view. */
export async function getTeamsData(): Promise<TeamsData | null> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return null
  const viewer = { id: session.user.id, role: session.profile?.role ?? 'sales_advisor' }

  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from('teams').select('id, name, leader_id, parent_team_id, is_active').eq('is_active', true),
    supabase.from('profiles').select('id, full_name, role, designation, team_id, photo_url').eq('is_active', true),
  ])

  const allTeams = (teams ?? []) as TeamRow[]

  // Teams the viewer can manage: admin → all; otherwise subtree of every team they lead.
  let manageableTeamIds: string[] = []
  if (viewer.role === 'admin') {
    manageableTeamIds = allTeams.map((t) => t.id)
  } else {
    const childrenOf = new Map<string, string[]>()
    for (const t of allTeams) {
      if (t.parent_team_id) {
        const arr = childrenOf.get(t.parent_team_id) ?? []
        arr.push(t.id)
        childrenOf.set(t.parent_team_id, arr)
      }
    }
    const led = allTeams.filter((t) => t.leader_id === viewer.id).map((t) => t.id)
    const seen = new Set<string>()
    const stack = [...led]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const c of childrenOf.get(id) ?? []) stack.push(c)
    }
    manageableTeamIds = [...seen]
  }

  return { teams: allTeams, members: (members ?? []) as MemberRow[], viewer, manageableTeamIds }
}

function tempPassword(): string {
  return 'Anon-' + randomBytes(4).toString('hex') + '@' + new Date().getFullYear()
}

/**
 * Creates a brand-new CRM user under a team. Admin can target any team; a
 * leader may only target a team within a subtree they lead.
 */
export async function addJunior(
  input: AddJuniorInput,
): Promise<{ success: boolean; error?: string; tempPassword?: string }> {
  const session = await getProfile()
  if (!session?.user) return { success: false, error: 'Not authenticated' }

  const data = await getTeamsData()
  if (!data) return { success: false, error: 'Not authorized' }
  if (!data.manageableTeamIds.includes(input.target_team_id)) {
    return { success: false, error: 'You can only add members within your own teams.' }
  }
  if (!input.full_name?.trim() || !input.email?.trim()) {
    return { success: false, error: 'Name and email are required' }
  }

  const svc = createServiceClient()
  const supabase = await createClient()

  const { data: targetTeam } = await supabase
    .from('teams')
    .select('id, leader_id, branch_id')
    .eq('id', input.target_team_id)
    .single()
  if (!targetTeam) return { success: false, error: 'Target team not found' }

  // 1. Create the auth user (a profile row is auto-created by the handle_new_user trigger).
  const password = tempPassword()
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: input.email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() },
  })
  if (createErr || !created?.user) {
    return { success: false, error: createErr?.message ?? 'Could not create user' }
  }
  const newUserId = created.user.id

  // 2. Optionally create a junior team led by the new user.
  let teamForMembership = input.target_team_id
  if (input.mode === 'team') {
    const { data: newTeam, error: teamErr } = await svc
      .from('teams')
      .insert({
        name: input.new_team_name?.trim() || `${input.full_name.trim()}'s Team`,
        leader_id: newUserId,
        parent_team_id: input.target_team_id,
        branch_id: targetTeam.branch_id,
      })
      .select('id')
      .single()
    if (teamErr) return { success: false, error: teamErr.message }
    // The new leader is a *member* of the parent team (so the parent leader sees them).
    teamForMembership = input.target_team_id
    void newTeam
  }

  // 3. Configure the new user's profile (service client bypasses RLS).
  const { error: profErr } = await svc
    .from('profiles')
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
      designation: input.designation?.trim() || null,
      team_id: teamForMembership,
      reporting_manager_id: targetTeam.leader_id,
      branch_id: targetTeam.branch_id,
      is_active: true,
    })
    .eq('id', newUserId)
  if (profErr) return { success: false, error: profErr.message }

  revalidatePath('/team/teams')
  return { success: true, tempPassword: password }
}

/** Re-parent a team under a different parent (admin only). Cycle-guarded by DB trigger. */
export async function reparentTeam(
  teamId: string,
  newParentId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const profile = (await getProfile())?.profile
  if (profile?.role !== 'admin') return { success: false, error: 'Admin only' }

  const supabase = await createClient()
  const { error } = await supabase.from('teams').update({ parent_team_id: newParentId }).eq('id', teamId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/team/teams')
  return { success: true }
}
