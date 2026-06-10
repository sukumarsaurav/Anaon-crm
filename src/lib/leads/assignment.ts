import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadSource } from '@/types/leads'

export interface AssignmentRule {
  id: string
  name: string
  priority: number
  is_active: boolean
  match_sources: LeadSource[] | null
  match_property_types: string[] | null
  match_cities: string[] | null
  budget_min: number | null
  budget_max: number | null
  assign_mode: 'specific' | 'round_robin'
  assign_to: string | null
  assign_pool: string[] | null
  branch_id: string | null
}

/** The subset of lead fields a rule can match on. */
export interface AssignableLead {
  source?: string | null
  property_type?: string | null
  city?: string | null
  budget_min?: number | null
  budget_max?: number | null
  branch_id?: string | null
}

/** True if every condition specified on the rule matches the lead. */
function ruleMatches(rule: AssignmentRule, lead: AssignableLead): boolean {
  if (rule.match_sources?.length) {
    if (!lead.source || !rule.match_sources.includes(lead.source as LeadSource)) return false
  }
  if (rule.match_property_types?.length) {
    if (!lead.property_type || !rule.match_property_types.includes(lead.property_type)) return false
  }
  if (rule.match_cities?.length) {
    const city = lead.city?.trim().toLowerCase()
    if (!city || !rule.match_cities.some((c) => c.trim().toLowerCase() === city)) return false
  }
  // Budget overlap: the lead's budget range must intersect the rule's range.
  if (rule.budget_min != null) {
    const leadMax = lead.budget_max ?? lead.budget_min ?? null
    if (leadMax != null && leadMax < rule.budget_min) return false
  }
  if (rule.budget_max != null) {
    const leadMin = lead.budget_min ?? lead.budget_max ?? null
    if (leadMin != null && leadMin > rule.budget_max) return false
  }
  return true
}

/** Pick the active sales advisor with the fewest open leads from a candidate set. */
async function pickLeastLoaded(
  supabase: SupabaseClient,
  opts: { candidateIds?: string[] | null; branchId?: string | null } = {},
): Promise<string | null> {
  let q = supabase.from('profiles').select('id').eq('role', 'sales_advisor').eq('is_active', true)
  if (opts.candidateIds?.length) q = q.in('id', opts.candidateIds)
  if (opts.branchId) q = q.eq('branch_id', opts.branchId)

  const { data: advisors } = await q
  if (!advisors?.length) return null

  const ids = advisors.map((a: { id: string }) => a.id)
  const { data: openLeads } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('is_active', true)
    .in('assigned_to', ids)
    .not('stage', 'in', '("closed_won","not_interested")')

  const counts = new Map<string, number>(ids.map((id: string) => [id, 0]))
  for (const row of openLeads ?? []) {
    const a = (row as { assigned_to: string | null }).assigned_to
    if (a && counts.has(a)) counts.set(a, (counts.get(a) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0]
}

/**
 * Resolve the advisor a lead should be assigned to.
 *
 * Evaluates active assignment rules in priority order (lowest first); the first
 * rule whose conditions all match wins. A matching rule either targets a
 * specific advisor or round-robins across its pool. If no rule matches (or the
 * matched target is unavailable), falls back to a global least-loaded
 * round-robin. Works with either the SSR or service-role client.
 */
export async function resolveAssignee(
  supabase: SupabaseClient,
  lead: AssignableLead,
): Promise<string | null> {
  const { data: rules } = await supabase
    .from('assignment_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  for (const rule of (rules ?? []) as AssignmentRule[]) {
    if (!ruleMatches(rule, lead)) continue

    if (rule.assign_mode === 'specific' && rule.assign_to) {
      // Honor the rule only if the target is still an active advisor.
      const { data: target } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', rule.assign_to)
        .eq('is_active', true)
        .maybeSingle()
      if (target) return rule.assign_to
      // else fall through to next rule
    } else if (rule.assign_mode === 'round_robin') {
      const picked = await pickLeastLoaded(supabase, {
        candidateIds: rule.assign_pool,
        branchId: rule.branch_id ?? lead.branch_id ?? null,
      })
      if (picked) return picked
    }
  }

  // No rule matched (or none resolvable) → global round-robin.
  return pickLeastLoaded(supabase, { branchId: lead.branch_id ?? null })
}
