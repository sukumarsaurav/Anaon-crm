'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import type { Lead, LeadActivity, LeadFilters, SiteVisit, DuplicateCheck } from '@/types/leads'
import { computeSlaStatus } from '@/lib/utils'

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const supabase = await createClient()

  const session = await getProfile()
  if (!session?.user) return []
  const { user } = session

  let query = supabase
    .from('leads')
    .select(
      `
      *,
      assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, phone, role, photo_url),
      project:projects(id, name, city, type, status)
    `
    )
    .eq('is_active', true)

  // Visibility is enforced by the team-hierarchy RLS policy on `leads`
  // (assignee + seniors up the chain; unassigned to admin/manager). No manual
  // role/branch scoping needed here — the DB returns only what the user may see.

  // View presets
  if (filters.view === 'my_leads') {
    query = query.eq('assigned_to', user.id)
  } else if (filters.view === 'hot') {
    query = query.gte('score', 80)
  } else if (filters.view === 'overdue') {
    query = query.lt('next_followup_at', new Date().toISOString()).not('next_followup_at', 'is', null)
  } else if (filters.view === 'today') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    query = query
      .gte('next_followup_at', todayStart.toISOString())
      .lte('next_followup_at', todayEnd.toISOString())
  } else if (filters.view === 'new_today') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    query = query.gte('created_at', todayStart.toISOString())
  } else if (filters.view === 'ready_to_buy') {
    query = query.in('stage', ['negotiation', 'token_paid'])
  } else if (filters.view === 'future_buyers') {
    query = query.eq('stage', 'future_followup')
  } else if (filters.view === 'visits_week') {
    // Leads with a site visit scheduled in the current week.
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data: visits } = await supabase
      .from('site_visits')
      .select('lead_id')
      .gte('scheduled_at', weekStart.toISOString())
      .lt('scheduled_at', weekEnd.toISOString())
      .in('status', ['scheduled', 'completed'])

    const leadIds = [...new Set((visits ?? []).map((v) => v.lead_id).filter(Boolean))]
    // No matches → return an impossible filter so the list is empty.
    query = query.in('id', leadIds.length ? leadIds : ['00000000-0000-0000-0000-000000000000'])
  }

  // Filters
  if (filters.stage?.length) {
    query = query.in('stage', filters.stage)
  }
  if (filters.source?.length) {
    query = query.in('source', filters.source)
  }
  if (filters.temperature?.length) {
    query = query.in('temperature', filters.temperature)
  }
  if (filters.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to)
  }
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`)
  }
  if (filters.score_min != null) {
    query = query.gte('score', filters.score_min)
  }
  if (filters.score_max != null) {
    query = query.lte('score', filters.score_max)
  }
  if (filters.budget_min != null) {
    query = query.gte('budget_max', filters.budget_min)
  }
  if (filters.budget_max != null) {
    query = query.lte('budget_min', filters.budget_max)
  }
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to)
  }
  if (filters.search) {
    query = query.or(
      `full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }

  // Sorting
  const sortBy = filters.sort_by || 'created_at'
  const sortDir = filters.sort_dir !== 'asc'
  query = query.order(sortBy, { ascending: !sortDir })

  const { data, error } = await query.limit(200)
  if (error) {
    console.error('getLeads error:', error)
    return []
  }

  return (data as Lead[]).map((lead) => {
    const { status, hoursRemaining } = computeSlaStatus(lead)
    return {
      ...lead,
      sla_status: status,
      sla_hours_remaining: hoursRemaining,
    }
  })
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
  const supabase = await createClient()

  let query = supabase
    .from('leads')
    .select(
      `id, full_name, phone, stage, created_at,
       assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, phone, role)`
    )
    .eq('is_active', true)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const orConditions: string[] = [`phone.eq.${phone}`]
  if (email) orConditions.push(`email.eq.${email}`)

  const { data, error } = await query.or(orConditions.join(','))

  if (error || !data?.length) {
    return { found: false, leads: [] }
  }

  const leads = data.map((d: Record<string, unknown>) => ({
    ...(d as object),
    match_type: (d.phone as string) === phone ? 'phone' : 'email',
  })) as DuplicateCheck['leads']

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
    .in('role', ['sales_advisor', 'manager'])
    .eq('is_active', true)

  if (branchId) query = query.eq('branch_id', branchId)

  const { data } = await query.order('full_name')
  return data ?? []
}

export async function getProjects() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, city, type, status')
    .eq('is_active', true)
    .order('name')
  return data ?? []
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
