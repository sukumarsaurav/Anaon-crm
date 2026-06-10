import type { UserRole } from './leads'

export type LeaveType = 'casual' | 'sick' | 'earned' | 'unpaid' | 'comp_off'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'on_leave' | 'holiday' | 'weekend'
export type AnnouncementType = 'announcement' | 'shoutout' | 'alert' | 'project_launch'

// ── Team hierarchy (chain) ──────────────────────────────────────────────────
export interface TeamRow {
  id: string
  name: string
  leader_id: string | null
  parent_team_id: string | null
  is_active: boolean
}

export interface MemberRow {
  id: string
  full_name: string
  role: string
  designation: string | null
  team_id: string | null
  photo_url: string | null
}

export interface TeamsData {
  teams: TeamRow[]
  members: MemberRow[]
  viewer: { id: string; role: string }
  /** Team ids the viewer may manage (admin → all; leader → their team subtrees). */
  manageableTeamIds: string[]
}

export interface AddJuniorInput {
  full_name: string
  email: string
  phone?: string
  role: 'manager' | 'sales_advisor' | 'telecaller'
  designation?: string
  target_team_id: string
  mode: 'member' | 'team'
  new_team_name?: string
}

export interface TeamMember {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: UserRole
  designation: string | null
  photo_url: string | null
  branch_id: string | null
  is_active: boolean
  employee_id: string | null
  joining_date: string | null
  date_of_birth: string | null
  base_salary: number | null
  emergency_contact: string | null
  address: string | null
  // Joined
  branch?: { id: string; name: string } | null
}

export interface TeamTarget {
  id: string
  user_id: string
  month: number
  year: number
  target_revenue: number
  target_bookings: number
  target_site_visits: number
  target_calls: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface IncentiveSlab {
  id: string
  label: string
  from_bookings: number
  to_bookings: number | null
  commission_percent: number
  bonus_amount: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface AttendanceLog {
  id: string
  user_id: string
  date: string
  check_in_at: string | null
  check_out_at: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_out_lat: number | null
  check_out_lng: number | null
  status: AttendanceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeaveRequest {
  id: string
  user_id: string
  leave_type: LeaveType
  from_date: string
  to_date: string
  days_count: number
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  // Joined
  member?: { id: string; full_name: string; photo_url: string | null } | null
  reviewer?: { id: string; full_name: string } | null
}

export interface Announcement {
  id: string
  title: string
  body: string
  type: AnnouncementType
  is_pinned: boolean
  branch_id: string | null
  author_id: string
  expires_at: string | null
  created_at: string
  updated_at: string
  // Joined
  author?: { id: string; full_name: string; photo_url: string | null } | null
}

// Computed at query time from lead_activities, site_visits, leads, whatsapp_messages
export interface DailyKPI {
  date: string
  calls_made: number
  connected_calls: number
  connection_rate: number      // 0–100
  followups_completed: number
  followups_scheduled: number
  new_leads_contacted: number  // new leads called within 2h
  site_visits_scheduled: number
  site_visits_completed: number
  proposals_sent: number
  bookings_done: number
  revenue_generated: number
  wa_messages_sent: number
}

export interface MonthlyKPI {
  month: number
  year: number
  calls_made: number
  connected_calls: number
  followups_completed: number
  site_visits_scheduled: number
  site_visits_completed: number
  bookings_done: number
  revenue_generated: number
  wa_messages_sent: number
}

export interface MemberPerformanceSummary {
  member: TeamMember
  target: TeamTarget | null
  monthly_kpi: MonthlyKPI
  today_kpi: DailyKPI
  achievement_revenue_pct: number     // 0–100+
  achievement_bookings_pct: number
  achievement_visits_pct: number
  is_at_risk: boolean                 // <50% target at mid-month
  today_attendance: AttendanceLog | null
}

export interface CommissionResult {
  current_slab: IncentiveSlab | null
  next_slab: IncentiveSlab | null
  commission_amount: number
  bonus_amount: number
  bookings_to_next: number | null
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  earned: 'Earned Leave',
  unpaid: 'Unpaid Leave',
  comp_off: 'Comp Off',
}

export const ATTENDANCE_STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present:  { label: 'Present',  color: 'text-green-700',  bg: 'bg-green-100' },
  absent:   { label: 'Absent',   color: 'text-red-700',    bg: 'bg-red-100' },
  half_day: { label: 'Half Day', color: 'text-amber-700',  bg: 'bg-amber-100' },
  on_leave: { label: 'On Leave', color: 'text-blue-700',   bg: 'bg-blue-100' },
  holiday:  { label: 'Holiday',  color: 'text-purple-700', bg: 'bg-purple-100' },
  weekend:  { label: 'Weekend',  color: 'text-gray-500',   bg: 'bg-gray-100' },
}

export const ANNOUNCEMENT_TYPE_CONFIG: Record<AnnouncementType, { label: string; color: string; bg: string }> = {
  announcement:    { label: 'Announcement',   color: 'text-blue-700',  bg: 'bg-blue-50' },
  shoutout:        { label: 'Shoutout',       color: 'text-amber-700', bg: 'bg-amber-50' },
  alert:           { label: 'Alert',          color: 'text-red-700',   bg: 'bg-red-50' },
  project_launch:  { label: 'Project Launch', color: 'text-green-700', bg: 'bg-green-50' },
}
