'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { getActiveProjectOptions } from '@/lib/cache/referenceData'
import type { Lead, LeadActivity, LeadFilters, SiteVisit, DuplicateCheck } from '@/types/leads'
import { computeSlaStatus } from '@/lib/utils'
import { istDayBounds, istDayStart, istWeekStart } from '@/lib/datetime'
import { searchOr } from '@/lib/supabase/search'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone } from './ingest'

const STAFF_ROLES = new Set(['admin', 'manager', 'sales_advisor', 'telecaller'])

/**
 * Columns the list views (table, kanban, overdue) actually render, plus what the SLA badge needs.
 * The lists are client components, so `*` (47 columns) was serialised into the page for every row:
 * 277 KB of HTML for 33 leads. The detail page still loads the full row via getLeadById.
 */
const LEADS_SELECT = `
  id, full_name, phone, email, city, source, stage, stage_changed_at, temperature, score,
  budget_min, budget_max, project_id, assigned_to, next_followup_at, is_active, created_at,
  assigned_profile:profiles!leads_assigned_to_fkey(id, full_name),
  project:projects(id, name)
`

/** Columns the list may be sorted by. Anything else in the URL fell through to PostgREST and errored into an empty list. */
const SORTABLE = new Set(['created_at', 'score', 'next_followup_at', 'full_name', 'stage_changed_at'])

/** Lead ids with a site visit scheduled in the current week (for the visits_week view). */
async function resolveVisitsWeekIds(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const weekStart = istWeekStart() // Sunday 00:00 IST; the server clock is UTC
  const weekEnd = istDayStart(weekStart, 7)

  const { data: visits } = await supabase
    .from('site_visits')
    .select('lead_id')
    .gte('scheduled_at', weekStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString())
    .in('status', ['scheduled', 'completed'])

  return [...new Set((visits ?? []).map((v) => v.lead_id).filter(Boolean))] as string[]
}

/**
 * Build a scoped leads query (view presets + filters + sort). Kept synchronous —
 * it returns the (unexecuted) PostgREST builder so callers can chain `.range()` /
 * `.limit()` and run it once. The one async preset (visits_week) is pre-resolved
 * into `visitWeekIds`. Visibility itself is enforced by the team-hierarchy RLS.
 */
function buildLeadsQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: LeadFilters,
  userId: string,
  opts: { head?: boolean; visitWeekIds?: string[] } = {}
) {
  const head = opts.head ?? false
  let query = head
    ? supabase.from('leads').select('id', { count: 'exact', head: true })
    : supabase.from('leads').select(LEADS_SELECT)
  query = query.eq('is_active', true)

  // View presets
  if (filters.view === 'my_leads') {
    query = query.eq('assigned_to', userId)
  } else if (filters.view === 'hot') {
    query = query.gte('score', 80)
  } else if (filters.view === 'overdue') {
    // Same rule as get_lead_stats' `overdue`, so the dashboard count matches the list it links to.
    query = query
      .lt('next_followup_at', new Date().toISOString())
      .not('next_followup_at', 'is', null)
      .not('stage', 'in', '(closed_won,not_interested)')
  } else if (filters.view === 'today') {
    // The IST day, not the server's (UTC) day, which ran 05:30 → 05:29 IST.
    const { start, end } = istDayBounds()
    query = query.gte('next_followup_at', start.toISOString()).lt('next_followup_at', end.toISOString())
  } else if (filters.view === 'new_today') {
    query = query.gte('created_at', istDayStart().toISOString())
  } else if (filters.view === 'ready_to_buy') {
    query = query.in('stage', ['negotiation', 'token_paid'])
  } else if (filters.view === 'future_buyers') {
    query = query.eq('stage', 'future_followup')
  } else if (filters.view === 'visits_week') {
    const ids = opts.visitWeekIds ?? []
    query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  // Filters
  if (filters.stage?.length) query = query.in('stage', filters.stage)
  if (filters.source?.length) query = query.in('source', filters.source)
  if (filters.temperature?.length) query = query.in('temperature', filters.temperature)
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.city) query = query.ilike('city', `%${filters.city}%`)
  if (filters.score_min != null) query = query.gte('score', filters.score_min)
  if (filters.score_max != null) query = query.lte('score', filters.score_max)
  if (filters.budget_min != null) query = query.gte('budget_max', filters.budget_min)
  if (filters.budget_max != null) query = query.lte('budget_min', filters.budget_max)
  if (filters.date_from) query = query.gte('created_at', filters.date_from)
  if (filters.date_to) query = query.lte('created_at', filters.date_to)
  const search = searchOr(filters.search, { text: ['full_name', 'email'], phone: ['phone'] })
  if (search) query = query.or(search)

  if (!head) {
    const sortBy = filters.sort_by && SORTABLE.has(filters.sort_by) ? filters.sort_by : 'created_at'
    query = query.order(sortBy, { ascending: filters.sort_dir === 'asc', nullsFirst: false })
  }
  return query
}

function withSla(rows: Lead[]): Lead[] {
  return rows.map((lead) => {
    const { status, hoursRemaining } = computeSlaStatus(lead)
    return { ...lead, sla_status: status, sla_hours_remaining: hoursRemaining }
  })
}

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return []

  const visitWeekIds = filters.view === 'visits_week' ? await resolveVisitsWeekIds(supabase) : undefined
  const query = buildLeadsQuery(supabase, filters, session.user.id, { visitWeekIds })

  const { data, error } = await query.limit(filters.limit ?? 200)
  if (error) {
    console.error('getLeads error:', error)
    return []
  }
  return withSla((data ?? []) as Lead[])
}

/** Paginated leads for the table view. Returns the page slice + total count. */
export async function getLeadsPage(
  filters: LeadFilters,
  page = 1,
  pageSize = 50
): Promise<{ leads: Lead[]; count: number }> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return { leads: [], count: 0 }

  const visitWeekIds = filters.view === 'visits_week' ? await resolveVisitsWeekIds(supabase) : undefined
  const from = (Math.max(1, page) - 1) * pageSize
  const to = from + pageSize - 1

  const [dataRes, countRes] = await Promise.all([
    buildLeadsQuery(supabase, filters, session.user.id, { visitWeekIds }).range(from, to),
    buildLeadsQuery(supabase, filters, session.user.id, { head: true, visitWeekIds }),
  ])

  if (dataRes.error) {
    console.error('getLeadsPage error:', dataRes.error)
    return { leads: [], count: 0 }
  }
  return { leads: withSla((dataRes.data ?? []) as Lead[]), count: countRes.count ?? 0 }
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      *,
      assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, phone, role, photo_url, designation),
      project:projects(id, name, city, type, status)
    `
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const { status, hoursRemaining } = computeSlaStatus(data as Lead)
  return {
    ...(data as Lead),
    sla_status: status,
    sla_hours_remaining: hoursRemaining,
  }
}

export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lead_activities')
    .select(
      `
      *,
      performer:profiles!lead_activities_performed_by_fkey(id, full_name, photo_url, role)
    `
    )
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data as LeadActivity[]
}

export async function getSiteVisits(leadId: string): Promise<SiteVisit[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('site_visits')
    .select(
      `
      *,
      project:projects(id, name, city),
      accompanied_profile:profiles!site_visits_accompanied_by_fkey(id, full_name, phone)
    `
    )
    .eq('lead_id', leadId)
    .order('scheduled_at', { ascending: false })

  if (error) return []
  return data as SiteVisit[]
}

export async function checkDuplicate(
  phone: string,
  email?: string,
  excludeId?: string
): Promise<DuplicateCheck> {
  const session = await getProfile()
  if (!session?.user || !STAFF_ROLES.has(session.profile?.role ?? '')) return { found: false, leads: [] }

  // Stored phones come in two shapes ("+91-98100 01025" from older and imported leads, bare
  // "9810001025" from the form), so an exact match missed 31 of 33 leads. Match on the last 10
  // digits, as ingestLead does.
  const digits = normalizePhone(phone) ?? phone.replace(/\D/g, '').slice(-10)
  const cleanEmail = email?.trim().toLowerCase()
  if (digits.length < 10 && !cleanEmail) return { found: false, leads: [] }

  // Across every lead, not just the caller's: under RLS an advisor never saw that someone else
  // already owns this number. Only the fields the warning shows are returned.
  const admin = createServiceClient()
  const conditions: string[] = []
  if (digits.length >= 10) conditions.push(`phone.ilike."%${digits}"`)
  if (cleanEmail) conditions.push(`email.ilike."${cleanEmail.replace(/["\\%]/g, '')}"`)

  let query = admin
    .from('leads')
    .select(
      `id, full_name, phone, email, stage, created_at,
       assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, role)`
    )
    .eq('is_active', true)
    .or(conditions.join(','))
    .limit(10)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error || !data?.length) {
    return { found: false, leads: [] }
  }

  // Which of them the caller may open (RLS), so the warning only links to those.
  const supabase = await createClient()
  const { data: visible } = await supabase.from('leads').select('id').in('id', data.map((d) => d.id))
  const visibleIds = new Set((visible ?? []).map((v) => v.id))

  const leads = data.map(({ email: leadEmail, ...d }) => ({
    ...d,
    match_type: digits.length >= 10 && String(d.phone ?? '').replace(/\D/g, '').endsWith(digits) ? 'phone' : (leadEmail ? 'email' : 'phone'),
    can_view: visibleIds.has(d.id),
  })) as unknown as DuplicateCheck['leads']

  return { found: true, leads }
}

export async function getLeadStats(userId: string, role: string, branchId?: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_lead_stats', {
    p_user_id: userId,
    p_role: role,
    p_branch_id: branchId ?? null,
  })
  return data ?? { total: 0, hot: 0, overdue: 0, todayFollowups: 0, newToday: 0 }
}

export async function getActiveAdvisors(branchId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, email, role, branch_id, designation, photo_url, is_active')
    // Everyone who can own a lead. Admins were left out, yet 31 of 33 leads sit with the admin:
    // they couldn't be filtered by owner or reassigned back. Telecallers own leads too.
    .in('role', ['sales_advisor', 'manager', 'admin', 'telecaller'])
    .eq('is_active', true)

  // Branch-less users (the admin) belong to every branch.
  if (branchId) query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)

  const { data } = await query.order('full_name')
  return data ?? []
}

/**
 * Active projects for the lead screens' project picker.
 *
 * Served from the shared reference-data cache — the row set is the same for
 * every user, so re-querying it on each render was a round-trip for nothing.
 */
export async function getProjects() {
  return getActiveProjectOptions()
}

export async function getRoundRobinAdvisor(branchId?: string): Promise<string | null> {
  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select('id')
    .eq('role', 'sales_advisor')
    .eq('is_active', true)

  if (branchId) query = query.eq('branch_id', branchId)

  const { data: advisors } = await query
  if (!advisors?.length) return null

  // Single query to get lead counts for all advisors
  const advisorIds = advisors.map(a => a.id)
  const { data: leadCounts } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('is_active', true)
    .not('stage', 'in', '("closed_won","not_interested")')
    .in('assigned_to', advisorIds)

  // Count in JS from the single query
  const countMap: Record<string, number> = {}
  for (const a of advisors) countMap[a.id] = 0
  for (const l of leadCounts ?? []) {
    if (l.assigned_to) countMap[l.assigned_to] = (countMap[l.assigned_to] ?? 0) + 1
  }

  const sorted = Object.entries(countMap).sort((a, b) => a[1] - b[1])
  return sorted[0]?.[0] ?? null
}
