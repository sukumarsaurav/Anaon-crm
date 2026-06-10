'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import type { AssignmentRule } from './assignment'

export interface AssignmentRuleInput {
  name: string
  priority: number
  is_active: boolean
  match_sources: string[] | null
  match_property_types: string[] | null
  match_cities: string[] | null
  budget_min: number | null
  budget_max: number | null
  assign_mode: 'specific' | 'round_robin'
  assign_to: string | null
  assign_pool: string[] | null
}

export interface AssignmentRuleRow extends AssignmentRule {
  assignee?: { full_name: string } | null
}

async function requireAdmin() {
  const profile = (await getProfile())?.profile
  if (profile?.role !== 'admin') return null
  return profile
}

export async function getAssignmentRules(): Promise<AssignmentRuleRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('assignment_rules')
    .select('*, assignee:profiles!assignment_rules_assign_to_fkey(full_name)')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as AssignmentRuleRow[]) ?? []
}

function clean(input: AssignmentRuleInput): Record<string, unknown> {
  const empties = (arr: string[] | null) => (arr && arr.length ? arr : null)
  return {
    name: input.name.trim(),
    priority: Number.isFinite(input.priority) ? input.priority : 100,
    is_active: input.is_active,
    match_sources: empties(input.match_sources),
    match_property_types: empties(input.match_property_types),
    match_cities: empties(input.match_cities?.map((c) => c.trim()).filter(Boolean) ?? null),
    budget_min: input.budget_min ?? null,
    budget_max: input.budget_max ?? null,
    assign_mode: input.assign_mode,
    assign_to: input.assign_mode === 'specific' ? input.assign_to : null,
    assign_pool: input.assign_mode === 'round_robin' ? empties(input.assign_pool) : null,
  }
}

export async function createAssignmentRule(
  input: AssignmentRuleInput,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: 'Admin only' }
  if (!input.name.trim()) return { success: false, error: 'Name is required' }
  if (input.assign_mode === 'specific' && !input.assign_to) {
    return { success: false, error: 'Select an advisor for a specific assignment' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('assignment_rules').insert(clean(input))
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/assignment')
  return { success: true }
}

export async function updateAssignmentRule(
  id: string,
  input: AssignmentRuleInput,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: 'Admin only' }

  const supabase = await createClient()
  const { error } = await supabase.from('assignment_rules').update(clean(input)).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/assignment')
  return { success: true }
}

export async function toggleAssignmentRule(
  id: string,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: 'Admin only' }

  const supabase = await createClient()
  const { error } = await supabase.from('assignment_rules').update({ is_active }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/assignment')
  return { success: true }
}

export async function deleteAssignmentRule(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: 'Admin only' }

  const supabase = await createClient()
  const { error } = await supabase.from('assignment_rules').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/assignment')
  return { success: true }
}
