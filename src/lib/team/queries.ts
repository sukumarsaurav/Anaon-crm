'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { calculateAchievementPct, isAtRisk } from './commission'
import type {
  TeamMember,
  TeamTarget,
  IncentiveSlab,
  AttendanceLog,
  LeaveRequest,
  Announcement,
  DailyKPI,
  MonthlyKPI,
  MemberPerformanceSummary,
} from '@/types/team'

export async function getTeamMembers(branchId?: string): Promise<TeamMember[]> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return []
  const { profile } = session

  let query = supabase
    .from('profiles')
    .select('*, branch:branches(id, name)')
    .eq('is_active', true)
    .order('full_name')

  if (profile?.role === 'manager') {
    query = query.eq('branch_id', profile.branch_id)
  } else if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data } = await query
  return (data ?? []) as TeamMember[]
}

export async function getMemberProfile(userId: string): Promise<TeamMember | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*, branch:branches(id, name)')
    .eq('id', userId)
    .single()
  return data as TeamMember | null
}

export async function getDailyKPI(userId: string, date: string): Promise<DailyKPI> {
  const supabase = await createClient()
  const dayStart = `${date}T00:00:00+00:00`
  const dayEnd   = `${date}T23:59:59+00:00`

  const [activitiesRes, visitsRes, bookingsRes, waRes] = await Promise.all([
    supabase
      .from('lead_activities')
      .select('activity_type, outcome, duration_minutes')
      .eq('performed_by', userId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),

    supabase
      .from('site_visits')
      .select('status, scheduled_at, visited_at')
      .eq('accompanied_by', userId)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd),

    supabase
      .from('leads')
      .select('id, budget_max')
      .eq('assigned_to', userId)
      .eq('stage', 'closed_won')
      .gte('updated_at', dayStart)
      .lte('updated_at', dayEnd),

    supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('sent_by', userId)
      .eq('direction', 'outbound')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
  ])

  const activities = activitiesRes.data ?? []
  const visits = visitsRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const waMsgs = waRes.data ?? []

  const calls_made = activities.filter((a) => a.activity_type === 'call').length
  const connected_calls = activities.filter(
    (a) => a.activity_type === 'call' && a.outcome !== 'no_answer' && a.outcome !== 'voicemail'
  ).length
  const followups_completed = activities.filter((a) => a.activity_type === 'follow_up').length
  const followups_scheduled = 0 // computed from pending follow-ups separately
  const proposals_sent = activities.filter((a) => a.activity_type === 'document_shared').length
  const revenue = bookings.reduce((sum, b) => sum + (b.budget_max ?? 0), 0)

  return {
    date,
    calls_made,
    connected_calls,
    connection_rate: calls_made > 0 ? Math.round((connected_calls / calls_made) * 100) : 0,
    followups_completed,
    followups_scheduled,
    new_leads_contacted: 0, // requires join on leads.created_at — left for reporting page
    site_visits_scheduled: visits.filter((v) => v.status === 'scheduled').length,
    site_visits_completed: visits.filter((v) => v.status === 'completed').length,
    proposals_sent,
    bookings_done: bookings.length,
    revenue_generated: revenue,
    wa_messages_sent: waMsgs.length,
  }
}

export async function getMonthlyKPI(userId: string, month: number, year: number): Promise<MonthlyKPI> {
  const supabase = await createClient()
  const from = new Date(year, month - 1, 1).toISOString()
  const to   = new Date(year, month, 0, 23, 59, 59).toISOString()

  const [activitiesRes, visitsRes, bookingsRes, waRes] = await Promise.all([
    supabase
      .from('lead_activities')
      .select('activity_type, outcome')
      .eq('performed_by', userId)
      .gte('created_at', from)
      .lte('created_at', to),

    supabase
      .from('site_visits')
      .select('status')
      .eq('accompanied_by', userId)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to),

    supabase
      .from('leads')
      .select('id, budget_max')
      .eq('assigned_to', userId)
      .eq('stage', 'closed_won')
      .gte('updated_at', from)
      .lte('updated_at', to),

    supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('sent_by', userId)
      .eq('direction', 'outbound')
      .gte('created_at', from)
      .lte('created_at', to),
  ])

  const activities = activitiesRes.data ?? []
  const visits = visitsRes.data ?? []
  const bookings = bookingsRes.data ?? []

  const calls_made = activities.filter((a) => a.activity_type === 'call').length
  const connected_calls = activities.filter(
    (a) => a.activity_type === 'call' && a.outcome !== 'no_answer' && a.outcome !== 'voicemail'
  ).length

  return {
    month,
    year,
    calls_made,
    connected_calls,
    followups_completed: activities.filter((a) => a.activity_type === 'follow_up').length,
    site_visits_scheduled: visits.filter((v) => v.status === 'scheduled').length,
    site_visits_completed: visits.filter((v) => v.status === 'completed').length,
    bookings_done: bookings.length,
    revenue_generated: bookings.reduce((sum, b) => sum + (b.budget_max ?? 0), 0),
    wa_messages_sent: waRes.data?.length ?? 0,
  }
}

export async function getMonthlyTarget(userId: string, month: number, year: number): Promise<TeamTarget | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .single()
  return data as TeamTarget | null
}

export async function getTeamPerformanceSummary(
  month: number,
  year: number,
  branchId?: string
): Promise<MemberPerformanceSummary[]> {
  const members = await getTeamMembers(branchId)
  const today = new Date().toISOString().split('T')[0]

  const summaries = await Promise.all(
    members
      .filter((m) => m.role === 'sales_advisor' || m.role === 'telecaller')
      .map(async (member): Promise<MemberPerformanceSummary> => {
        const [target, monthly_kpi, today_kpi, todayAttendance] = await Promise.all([
          getMonthlyTarget(member.id, month, year),
          getMonthlyKPI(member.id, month, year),
          getDailyKPI(member.id, today),
          getTodayAttendance(member.id),
        ])

        const achievement_revenue_pct = calculateAchievementPct(
          monthly_kpi.revenue_generated,
          target?.target_revenue ?? 0
        )
        const achievement_bookings_pct = calculateAchievementPct(
          monthly_kpi.bookings_done,
          target?.target_bookings ?? 0
        )
        const achievement_visits_pct = calculateAchievementPct(
          monthly_kpi.site_visits_completed,
          target?.target_site_visits ?? 0
        )

        return {
          member,
          target,
          monthly_kpi,
          today_kpi,
          achievement_revenue_pct,
          achievement_bookings_pct,
          achievement_visits_pct,
          is_at_risk: isAtRisk(achievement_revenue_pct),
          today_attendance: todayAttendance,
        }
      })
  )

  // Sort by revenue achievement descending (leaderboard)
  return summaries.sort((a, b) => b.achievement_revenue_pct - a.achievement_revenue_pct)
}

async function getTodayAttendance(userId: string): Promise<AttendanceLog | null> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  return data as AttendanceLog | null
}

export async function getAttendanceLogs(
  userId: string,
  month: number,
  year: number
): Promise<AttendanceLog[]> {
  const supabase = await createClient()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = new Date(year, month, 0).toISOString().split('T')[0]
  const { data } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  return (data ?? []) as AttendanceLog[]
}

export async function getLeaveRequests(
  userId?: string,
  status?: string
): Promise<LeaveRequest[]> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return []
  const { user, profile } = session

  let query = supabase
    .from('leave_requests')
    .select(`
      *,
      member:profiles!leave_requests_user_id_fkey(id, full_name, photo_url),
      reviewer:profiles!leave_requests_reviewed_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (profile?.role === 'sales_advisor' || profile?.role === 'telecaller') {
    query = query.eq('user_id', user.id)
  } else if (userId) {
    query = query.eq('user_id', userId)
  }

  if (status) query = query.eq('status', status)

  const { data } = await query.limit(100)
  return (data ?? []) as LeaveRequest[]
}

export async function getAnnouncements(branchId?: string): Promise<Announcement[]> {
  const supabase = await createClient()
  let query = supabase
    .from('announcements')
    .select('*, author:profiles!announcements_author_id_fkey(id, full_name, photo_url)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // Expired announcements filtered out
  query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  if (branchId) {
    query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  }

  const { data } = await query
  return (data ?? []) as Announcement[]
}

export async function getIncentiveSlabs(): Promise<IncentiveSlab[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('incentive_slabs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as IncentiveSlab[]
}

export async function getPendingLeaveCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('leave_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}
