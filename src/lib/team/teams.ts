'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { writeAuditLog } from '@/lib/security/audit'
import { createStaffAccount } from './provision'
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

  const res = await createStaffAccount({ id: session.user.id, role: data.viewer.role, manageableTeamIds: data.manageableTeamIds }, input)
  if (res.success) revalidatePath('/team/teams')
  return { success: res.success, error: res.error, tempPassword: res.tempPassword }
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

/** Set or clear a team's leader (admin only). The leader sees everyone in the team's subtree. */
export async function setTeamLeader(
  teamId: string,
  leaderId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const session = await getProfile()
  if (session?.profile?.role !== 'admin') return { success: false, error: 'Admin only' }

  const supabase = await createClient()
  if (leaderId) {
    const { data: leader } = await supabase.from('profiles').select('id, role, is_active').eq('id', leaderId).maybeSingle()
    if (!leader || !leader.is_active || leader.role === 'broker') return { success: false, error: 'Choose an active staff member' }
  }
  const { data: before } = await supabase.from('teams').select('leader_id').eq('id', teamId).maybeSingle()
  const { error } = await supabase.from('teams').update({ leader_id: leaderId }).eq('id', teamId)
  if (error) return { success: false, error: error.message }

  await writeAuditLog({
    userId: session.user.id, action: 'user_updated', tableName: 'teams', recordId: teamId,
    oldValues: { leader_id: before?.leader_id ?? null }, newValues: { leader_id: leaderId },
  })
  revalidatePath('/team/teams')
  revalidatePath('/team')
  return { success: true }
}
