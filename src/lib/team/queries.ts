/**
 * Team reads. Plain server module (not 'use server'): pages call these directly; exporting them as
 * server actions only made them callable from any browser.
 */
import { todayIST, istDayBounds, istMonthBounds } from '@/lib/datetime'
import { fetchAll } from '@/lib/supabase/fetchAll'
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

/**
 * Active staff the viewer may manage: RLS on profiles already scopes this to admins (everyone) and
 * team leaders (their subtree). Filtering managers by branch on top hid the whole team when the
 * manager had no branch, and ignored the team chain the rest of the CRM uses.
 */
export async function getTeamMembers(branchId?: string): Promise<TeamMember[]> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return []

  let query = supabase
    .from('profiles')
    .select('*, branch:branches(id, name)')
    .eq('is_active', true)
    .in('role', ['admin', 'manager', 'sales_advisor', 'telecaller'])
    .order('full_name')
  if (branchId) query = query.eq('branch_id', branchId)

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

// Contact attempts count as follow-ups done ('follow_up' is not a lead_activities type, so the old
// filter was always 0).
const TOUCH_TYPES = ['call', 'whatsapp', 'email', 'sms']

interface KpiRows {
  activities: { performed_by: string; type: string; outcome: string | null }[]
  visits: { accompanied_by: string | null; visited_by: string | null; status: string }[]
  bookings: { advisor_id: string; total_sale_value: number | null }[]
  messages: { sent_by: string }[]
}

/**
 * Activity, visits, bookings and WhatsApp for many people in one window. Revenue and bookings come
 * from confirmed bookings (sale value, booking date) — not from `leads.budget_max` of won leads
 * filtered on `updated_at`, which counted a lead again in whatever month someone next edited it.
 */
async function loadKpiRows(userIds: string[], start: Date, end: Date): Promise<KpiRows> {
  if (!userIds.length) return { activities: [], visits: [], bookings: [], messages: [] }
  const supabase = await createClient()
  const from = start.toISOString(), to = end.toISOString()
  const fromDay = todayIST(start), toDay = todayIST(new Date(end.getTime() - 1))
  const ids = userIds.join(',')
  const [activities, visits, bookings, messages] = await Promise.all([
    fetchAll<KpiRows['activities'][number]>((a, b) => supabase.from('lead_activities').select('id, performed_by, type, outcome')
      .in('performed_by', userIds).gte('created_at', from).lt('created_at', to).order('id').range(a, b)),
    fetchAll<KpiRows['visits'][number]>((a, b) => supabase.from('site_visits').select('id, accompanied_by, visited_by, status')
      .or(`accompanied_by.in.(${ids}),visited_by.in.(${ids})`).gte('scheduled_at', from).lt('scheduled_at', to).order('id').range(a, b)),
    fetchAll<KpiRows['bookings'][number]>((a, b) => supabase.from('bookings').select('id, advisor_id, total_sale_value')
      .in('advisor_id', userIds).eq('status', 'confirmed').gte('booking_date', fromDay).lte('booking_date', toDay).order('id').range(a, b)),
    fetchAll<KpiRows['messages'][number]>((a, b) => supabase.from('whatsapp_messages').select('id, sent_by')
      .in('sent_by', userIds).eq('direction', 'outbound').gte('created_at', from).lt('created_at', to).order('id').range(a, b)),
  ])
  return { activities, visits, bookings, messages }
}

function kpiFor(userId: string, rows: KpiRows) {
  const acts = rows.activities.filter((a) => a.performed_by === userId)
  const calls = acts.filter((a) => a.type === 'call')
  const connected = calls.filter((a) => String(a.outcome ?? '').startsWith('connected')).length
  const visits = rows.visits.filter((v) => v.accompanied_by === userId || v.visited_by === userId)
  const bookings = rows.bookings.filter((b) => b.advisor_id === userId)
  return {
    calls_made: calls.length,
    connected_calls: connected,
    followups_completed: acts.filter((a) => TOUCH_TYPES.includes(a.type)).length,
    proposals_sent: acts.filter((a) => a.type === 'document_shared').length,
    site_visits_scheduled: visits.filter((v) => v.status === 'scheduled').length,
    site_visits_completed: visits.filter((v) => v.status === 'completed').length,
    bookings_done: bookings.length,
    revenue_generated: bookings.reduce((sum, b) => sum + Number(b.total_sale_value ?? 0), 0),
    wa_messages_sent: rows.messages.filter((m) => m.sent_by === userId).length,
  }
}

function toDaily(date: string, k: ReturnType<typeof kpiFor>): DailyKPI {
  return {
    date,
    calls_made: k.calls_made,
    connected_calls: k.connected_calls,
    connection_rate: k.calls_made > 0 ? Math.round((k.connected_calls / k.calls_made) * 100) : 0,
    followups_completed: k.followups_completed,
    followups_scheduled: 0, // computed from pending follow-ups separately
    new_leads_contacted: 0, // requires join on leads.created_at — left for reporting page
    site_visits_scheduled: k.site_visits_scheduled,
    site_visits_completed: k.site_visits_completed,
    proposals_sent: k.proposals_sent,
    bookings_done: k.bookings_done,
    revenue_generated: k.revenue_generated,
    wa_messages_sent: k.wa_messages_sent,
  }
}

function toMonthly(month: number, year: number, k: ReturnType<typeof kpiFor>): MonthlyKPI {
  return {
    month, year,
    calls_made: k.calls_made,
    connected_calls: k.connected_calls,
    followups_completed: k.followups_completed,
    site_visits_scheduled: k.site_visits_scheduled,
    site_visits_completed: k.site_visits_completed,
    bookings_done: k.bookings_done,
    revenue_generated: k.revenue_generated,
    wa_messages_sent: k.wa_messages_sent,
  }
}

/** One IST calendar day ("YYYY-MM-DD"). */
export async function getDailyKPI(userId: string, date: string): Promise<DailyKPI> {
  const { start, end } = istDayBounds(new Date(`${date}T12:00:00+05:30`))
  return toDaily(date, kpiFor(userId, await loadKpiRows([userId], start, end)))
}

/** One IST calendar month. */
export async function getMonthlyKPI(userId: string, month: number, year: number): Promise<MonthlyKPI> {
  const { start, end } = istMonthBounds(year, month)
  return toMonthly(month, year, kpiFor(userId, await loadKpiRows([userId], start, end)))
}

export async function getMonthlyTarget(userId: string, month: number, year: number): Promise<TeamTarget | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  return data as TeamTarget | null
}

/** Leaderboard: a fixed handful of queries for the whole team (it was ~17 per member). */
export async function getTeamPerformanceSummary(
  month: number,
  year: number,
  branchId?: string
): Promise<MemberPerformanceSummary[]> {
  const members = (await getTeamMembers(branchId)).filter((m) => m.role === 'sales_advisor' || m.role === 'telecaller')
  if (!members.length) return []
  const ids = members.map((m) => m.id)
  const today = todayIST()
  const supabase = await createClient()
  const month_ = istMonthBounds(year, month)
  const day = istDayBounds()

  const [monthRows, dayRows, { data: targets }, { data: attendance }] = await Promise.all([
    loadKpiRows(ids, month_.start, month_.end),
    loadKpiRows(ids, day.start, day.end),
    supabase.from('team_targets').select('*').in('user_id', ids).eq('month', month).eq('year', year),
    supabase.from('attendance_logs').select('*').in('user_id', ids).eq('date', today),
  ])
  const targetBy = new Map((targets ?? []).map((t) => [t.user_id as string, t as TeamTarget]))
  const attendanceBy = new Map((attendance ?? []).map((a) => [a.user_id as string, a as AttendanceLog]))

  const summaries = members.map((member): MemberPerformanceSummary => {
    const target = targetBy.get(member.id) ?? null
    const monthly_kpi = toMonthly(month, year, kpiFor(member.id, monthRows))
    const achievement_revenue_pct = calculateAchievementPct(monthly_kpi.revenue_generated, target?.target_revenue ?? 0)
    return {
      member,
      target,
      monthly_kpi,
      today_kpi: toDaily(today, kpiFor(member.id, dayRows)),
      achievement_revenue_pct,
      achievement_bookings_pct: calculateAchievementPct(monthly_kpi.bookings_done, target?.target_bookings ?? 0),
      achievement_visits_pct: calculateAchievementPct(monthly_kpi.site_visits_completed, target?.target_site_visits ?? 0),
      // No target set means there is nothing to be behind on (it showed every member At Risk).
      is_at_risk: (target?.target_revenue ?? 0) > 0 && isAtRisk(achievement_revenue_pct),
      today_attendance: attendanceBy.get(member.id) ?? null,
    }
  })

  // Sort by revenue achievement descending (leaderboard)
  return summaries.sort((a, b) => b.achievement_revenue_pct - a.achievement_revenue_pct)
}

/** Targets for several people in one month, keyed by user id. */
export async function getMonthlyTargets(userIds: string[], month: number, year: number): Promise<Record<string, TeamTarget | null>> {
  if (!userIds.length) return {}
  const supabase = await createClient()
  const { data } = await supabase.from('team_targets').select('*').in('user_id', userIds).eq('month', month).eq('year', year)
  const out: Record<string, TeamTarget | null> = Object.fromEntries(userIds.map((id) => [id, null]))
  for (const t of data ?? []) out[t.user_id as string] = t as TeamTarget
  return out
}

export async function getAttendanceLogs(
  userId: string,
  month: number,
  year: number
): Promise<AttendanceLog[]> {
  const supabase = await createClient()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
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
