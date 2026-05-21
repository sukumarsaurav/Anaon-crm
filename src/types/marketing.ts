export type CampaignPlatform =
  | 'facebook' | 'instagram' | 'google' | 'youtube'
  | 'whatsapp' | 'portal99acres' | 'magicbricks' | 'housing' | 'other'

export type CampaignObjective = 'lead_generation' | 'awareness' | 'retargeting' | 'conversion'
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'archived'

export interface MarketingCampaign {
  id: string
  name: string
  platform: CampaignPlatform
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  project_id: string | null
  start_date: string
  end_date: string | null
  budget: number
  spend: number
  objective: CampaignObjective | null
  status: CampaignStatus
  meta_campaign_id: string | null
  meta_adset_id: string | null
  meta_ad_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  project?: { name: string } | null
}

export interface CampaignSpendLog {
  id: string
  campaign_id: string
  log_date: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  notes: string | null
  logged_by: string | null
  created_at: string
}

export interface CampaignROI {
  utm_source: string
  utm_campaign: string | null
  platform: string | null
  campaign_id: string | null
  campaign_name: string | null
  leads_count: number
  site_visits_count: number
  bookings_count: number
  revenue: number
  spend: number
  cpl: number | null          // cost per lead
  cpv: number | null          // cost per site visit
  cpb: number | null          // cost per booking
  roas: number | null         // return on ad spend
  lead_to_visit_rate: number  // %
  visit_to_booking_rate: number // %
}

export interface SourceROI {
  utm_source: string
  leads_count: number
  site_visits_count: number
  bookings_count: number
  revenue: number
  spend: number
  cpl: number | null
  roas: number | null
  lead_to_visit_rate: number
  visit_to_booking_rate: number
}

export const PLATFORM_CONFIG: Record<CampaignPlatform, { label: string; color: string; bg: string }> = {
  facebook:      { label: 'Facebook',      color: 'text-blue-700',   bg: 'bg-blue-50' },
  instagram:     { label: 'Instagram',     color: 'text-pink-700',   bg: 'bg-pink-50' },
  google:        { label: 'Google Ads',    color: 'text-red-700',    bg: 'bg-red-50' },
  youtube:       { label: 'YouTube',       color: 'text-red-700',    bg: 'bg-red-50' },
  whatsapp:      { label: 'WhatsApp',      color: 'text-green-700',  bg: 'bg-green-50' },
  portal99acres: { label: '99acres',       color: 'text-orange-700', bg: 'bg-orange-50' },
  magicbricks:   { label: 'MagicBricks',   color: 'text-red-700',    bg: 'bg-red-50' },
  housing:       { label: 'Housing.com',   color: 'text-purple-700', bg: 'bg-purple-50' },
  other:         { label: 'Other',         color: 'text-gray-700',   bg: 'bg-gray-100' },
}

export const CAMPAIGN_PLATFORMS: { value: CampaignPlatform; label: string }[] = [
  { value: 'facebook',      label: 'Facebook' },
  { value: 'instagram',     label: 'Instagram' },
  { value: 'google',        label: 'Google Ads' },
  { value: 'youtube',       label: 'YouTube' },
  { value: 'whatsapp',      label: 'WhatsApp' },
  { value: 'portal99acres', label: '99acres' },
  { value: 'magicbricks',   label: 'MagicBricks' },
  { value: 'housing',       label: 'Housing.com' },
  { value: 'other',         label: 'Other' },
]

export const CAMPAIGN_OBJECTIVES: { value: CampaignObjective; label: string }[] = [
  { value: 'lead_generation', label: 'Lead Generation' },
  { value: 'awareness',       label: 'Brand Awareness' },
  { value: 'retargeting',     label: 'Retargeting' },
  { value: 'conversion',      label: 'Conversion' },
]
