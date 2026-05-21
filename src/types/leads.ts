export type UserRole = 'admin' | 'manager' | 'sales_advisor' | 'telecaller'

export type LeadStage =
  | 'new_lead'
  | 'contacted'
  | 'interested'
  | 'site_visit_scheduled'
  | 'site_visit_done'
  | 'negotiation'
  | 'closed_won'
  | 'not_interested'
  | 'future_followup'

export type LeadTemperature = 'hot' | 'warm' | 'cold'

export type LeadSource =
  | 'facebook_ads'
  | 'instagram_ads'
  | 'google_ads'
  | 'website_form'
  | 'whatsapp'
  | 'manual'
  | 'walk_in'
  | 'referral'
  | 'ivr'
  | 'portal'
  | 'broker'

export type FollowUpOutcome =
  | 'connected_interested'
  | 'connected_not_interested'
  | 'not_reachable'
  | 'number_invalid'
  | 'callback_requested'
  | 'voicemail'

export type ActivityType =
  | 'call'
  | 'whatsapp'
  | 'email'
  | 'sms'
  | 'note'
  | 'stage_change'
  | 'assignment'
  | 'site_visit'
  | 'document_shared'
  | 'system'

export type SlaStatus = 'on_time' | 'at_risk' | 'breached'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: UserRole
  branch_id: string | null
  designation: string | null
  photo_url: string | null
  is_active: boolean
}

export interface Branch {
  id: string
  name: string
  city: string
}

export interface Project {
  id: string
  name: string
  city: string
  type: string
  status: string
}

export interface Lead {
  id: string
  full_name: string
  phone: string
  alternate_phone: string | null
  email: string | null
  city: string | null
  locality: string | null
  // Interest
  project_id: string | null
  property_type: string | null
  budget_min: number | null
  budget_max: number | null
  configuration: string | null
  purpose: 'investment' | 'self_use' | 'rental' | null
  timeline: 'immediate' | '3_months' | '6_months' | '1_year_plus' | null
  // Source & UTM
  source: LeadSource
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  campaign_name: string | null
  ad_set_name: string | null
  keyword: string | null
  landing_page_url: string | null
  device_type: string | null
  // Assignment & scoring
  assigned_to: string | null
  branch_id: string | null
  stage: LeadStage
  temperature: LeadTemperature
  score: number
  // Follow-up
  next_followup_at: string | null
  last_contacted_at: string | null
  preferred_contact_time: string | null
  preferred_contact_method: string | null
  follow_up_count: number
  // Meta
  broker_id: string | null
  referred_by_client_id: string | null
  whatsapp_opt_in: boolean
  is_duplicate: boolean
  duplicate_of: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  assigned_profile?: Profile | null
  project?: Project | null
  sla_status?: SlaStatus
  sla_hours_remaining?: number | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  type: ActivityType
  outcome: FollowUpOutcome | null
  notes: string | null
  stage_from: LeadStage | null
  stage_to: LeadStage | null
  call_duration_seconds: number | null
  scheduled_at: string | null
  performed_by: string | null
  created_at: string
  performer?: Profile | null
}

export interface SiteVisit {
  id: string
  lead_id: string
  project_id: string | null
  scheduled_at: string
  visited_at: string | null
  accompanied_by: string | null
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  client_feedback: string | null
  advisor_notes: string | null
  created_at: string
  project?: Project | null
  accompanied_profile?: Profile | null
}

export interface LeadFilters {
  stage?: LeadStage[]
  source?: LeadSource[]
  temperature?: LeadTemperature[]
  assigned_to?: string
  project_id?: string
  city?: string
  score_min?: number
  score_max?: number
  budget_min?: number
  budget_max?: number
  date_from?: string
  date_to?: string
  view?: 'my_leads' | 'all' | 'hot' | 'overdue' | 'today' | 'new_today'
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface DuplicateCheck {
  found: boolean
  leads: Array<{
    id: string
    full_name: string
    phone: string
    stage: LeadStage
    assigned_profile: Profile | null
    created_at: string
    match_type: 'phone' | 'email' | 'name_city'
  }>
}

export interface LeadScoreInput {
  lead: Partial<Lead>
  activities: LeadActivity[]
  projectBudgetMin?: number
  projectBudgetMax?: number
}

export interface StageConfig {
  label: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  slaHours: number | null
}

export const STAGE_CONFIG: Record<LeadStage, StageConfig> = {
  new_lead: {
    label: 'New Lead',
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    slaHours: 2,
  },
  contacted: {
    label: 'Contacted',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    slaHours: 24,
  },
  interested: {
    label: 'Interested',
    color: 'violet',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    slaHours: 48,
  },
  site_visit_scheduled: {
    label: 'Visit Scheduled',
    color: 'amber',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    slaHours: null,
  },
  site_visit_done: {
    label: 'Visit Done',
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    slaHours: 24,
  },
  negotiation: {
    label: 'Negotiation',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    slaHours: null,
  },
  closed_won: {
    label: 'Closed Won',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    slaHours: null,
  },
  not_interested: {
    label: 'Not Interested',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    slaHours: null,
  },
  future_followup: {
    label: 'Future Follow-up',
    color: 'slate',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    slaHours: null,
  },
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  facebook_ads: 'Facebook Ads',
  instagram_ads: 'Instagram Ads',
  google_ads: 'Google Ads',
  website_form: 'Website Form',
  whatsapp: 'WhatsApp',
  manual: 'Manual Entry',
  walk_in: 'Walk-in',
  referral: 'Referral',
  ivr: 'IVR / Missed Call',
  portal: 'Portal (99acres/MagicBricks)',
  broker: 'Broker',
}

export const STAGE_ORDER: LeadStage[] = [
  'new_lead',
  'contacted',
  'interested',
  'site_visit_scheduled',
  'site_visit_done',
  'negotiation',
  'closed_won',
  'not_interested',
  'future_followup',
]

export const TERMINAL_STAGES: LeadStage[] = ['closed_won', 'not_interested']

export const FOLLOW_UP_OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  connected_interested: 'Connected — Interested',
  connected_not_interested: 'Connected — Not Interested',
  not_reachable: 'Not Reachable',
  number_invalid: 'Number Invalid',
  callback_requested: 'Asked to Call Back',
  voicemail: 'Left Voicemail',
}
