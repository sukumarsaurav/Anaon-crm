import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateLeadScore } from './scoring'
import type { Lead, LeadActivity } from '@/types/leads'

/**
 * Scores a lead with the project's real price range. Every caller used to call calculateLeadScore
 * without it, so the "budget matches inventory" (+20) and "large mismatch" (−15) signals could
 * never apply. Plain module (takes the client), not a server action.
 */
export async function scoreLead(
  supabase: SupabaseClient,
  lead: Partial<Lead>,
  activities: LeadActivity[],
) {
  let projectBudgetMin: number | undefined
  let projectBudgetMax: number | undefined

  if (lead.project_id && lead.budget_min != null && lead.budget_max != null) {
    const { data: plots } = await supabase
      .from('plots')
      .select('total_price')
      .eq('project_id', lead.project_id)
      .in('status', ['available', 'soft_hold'])
      .not('total_price', 'is', null)
    const prices = (plots ?? []).map((p) => Number(p.total_price)).filter((n) => Number.isFinite(n) && n > 0)
    if (prices.length) {
      projectBudgetMin = Math.min(...prices)
      projectBudgetMax = Math.max(...prices)
    }
  }

  return calculateLeadScore({ lead, activities, projectBudgetMin, projectBudgetMax })
}
