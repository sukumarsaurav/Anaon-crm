export type ProjectType = 'plotted_development' | 'villa' | 'apartment' | 'commercial'
export type ProjectStatus = 'pre_launch' | 'launched' | 'under_construction' | 'ready_to_move' | 'sold_out'
export type PlotType = 'corner' | 'regular' | 'park_facing' | 'road_facing'
export type PlotFacing = 'north' | 'south' | 'east' | 'west' | 'north_east' | 'north_west' | 'south_east' | 'south_west'
export type PlotStatus = 'available' | 'soft_hold' | 'booked' | 'registered' | 'sold' | 'not_for_sale'
export type PremiumType = 'corner' | 'park_facing' | 'road_facing' | 'east_facing' | 'other'
export type DocumentCategory =
  | 'layout_approval' | 'noc' | 'rera_certificate' | 'title_deed'
  | 'environmental_clearance' | 'bank_approval' | 'demand_letter'
  | 'agreement_template' | 'sale_deed_template' | 'brochure' | 'price_list' | 'other'

export interface Project {
  id: string
  name: string
  type: ProjectType
  city: string
  locality: string | null
  address: string | null
  google_maps_pin: string | null
  rera_number: string | null
  rera_registration_date: string | null
  rera_expiry_date: string | null
  status: ProjectStatus
  launch_date: string | null
  expected_completion_date: string | null
  description: string | null
  total_units: number | null
  branch_id: string | null
  project_manager_id: string | null
  brochure_url: string | null
  price_list_url: string | null
  video_url: string | null
  virtual_tour_url: string | null
  layout_image_url: string | null
  gallery_urls: string[]
  amenities: string[]
  legal_contact: string | null
  contractor_name: string | null
  hold_duration_hours: number
  max_holds_per_advisor: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  project_manager?: { id: string; full_name: string } | null
  branch?: { id: string; name: string } | null
}

export interface ProjectStats {
  total: number
  available: number
  soft_hold: number
  booked: number
  registered: number
  sold: number
  not_for_sale: number
  revenue_potential: number   // sum of total_price for available plots
  revenue_booked: number      // sum of total_price for booked/registered/sold
}

export interface Plot {
  id: string
  project_id: string
  plot_number: string
  size_sqyd: number | null
  size_sqft: number | null
  type: PlotType
  facing: PlotFacing | null
  floor_number: number | null
  configuration: string | null
  base_price: number
  base_price_per_sqyd: number | null
  corner_premium: number
  facing_premium: number
  other_premium: number
  development_charges: number
  total_price: number | null
  status: PlotStatus
  held_by: string | null
  held_until: string | null
  booked_by_client_id: string | null
  booking_date: string | null
  notes: string | null
  grid_row: number | null
  grid_col: number | null
  created_at: string
  updated_at: string
  // Joined
  held_by_profile?: { id: string; full_name: string } | null
  booked_by_client?: { id: string; full_name: string } | null
}

export interface PlotHoldLog {
  id: string
  plot_id: string
  project_id: string
  held_by: string
  held_at: string
  expires_at: string
  released_at: string | null
  outcome: 'booked' | 'released' | 'expired' | null
  lead_id: string | null
  notes: string | null
  created_at: string
  // Joined
  held_by_profile?: { id: string; full_name: string } | null
}

export interface PremiumMatrix {
  id: string
  project_id: string
  premium_type: PremiumType
  percent: number
  label: string | null
  created_at: string
}

export interface ProjectDocument {
  id: string
  project_id: string
  name: string
  category: DocumentCategory
  file_url: string
  file_size: number | null
  mime_type: string | null
  is_public: boolean
  uploaded_by: string | null
  created_at: string
  uploader?: { id: string; full_name: string } | null
}

export interface PriceEscalation {
  id: string
  project_id: string
  escalation_date: string
  percentage_increase: number
  notes: string | null
  applied: boolean
  created_by: string | null
  created_at: string
}

// Cost sheet computed from a plot
export interface CostSheet {
  plot: Plot
  project: Project
  base_price: number
  premiums: Array<{ label: string; amount: number }>
  total_premium: number
  development_charges: number
  sub_total: number
  registration_charges: number  // estimated 6% of base price
  gst: number                   // 5% on construction component (for apartments) or 0 for plots
  total_payable: number
  generated_at: string
}

// ── Display config ────────────────────────────────────────────

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; border: string }> = {
  pre_launch:        { label: 'Pre-Launch',        color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  launched:          { label: 'Launched',           color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  under_construction:{ label: 'Under Construction', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  ready_to_move:     { label: 'Ready to Move',      color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  sold_out:          { label: 'Sold Out',            color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200' },
}

export const PLOT_STATUS_CONFIG: Record<PlotStatus, { label: string; color: string; bg: string; mapColor: string }> = {
  available:    { label: 'Available',    color: 'text-green-700',  bg: 'bg-green-50',   mapColor: 'bg-green-400 hover:bg-green-500' },
  soft_hold:    { label: 'Soft Hold',    color: 'text-amber-700',  bg: 'bg-amber-50',   mapColor: 'bg-amber-400 hover:bg-amber-500' },
  booked:       { label: 'Booked',       color: 'text-red-700',    bg: 'bg-red-50',     mapColor: 'bg-red-400 hover:bg-red-500' },
  registered:   { label: 'Registered',   color: 'text-red-700',    bg: 'bg-red-50',     mapColor: 'bg-red-500 hover:bg-red-600' },
  sold:         { label: 'Sold',         color: 'text-gray-700',   bg: 'bg-gray-100',   mapColor: 'bg-gray-500 hover:bg-gray-600' },
  not_for_sale: { label: 'Not for Sale', color: 'text-gray-500',   bg: 'bg-gray-50',    mapColor: 'bg-gray-300 cursor-not-allowed' },
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  plotted_development: 'Plotted Development',
  villa:               'Villa',
  apartment:           'Apartment',
  commercial:          'Commercial',
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  layout_approval:      'Layout Approval',
  noc:                  'NOC',
  rera_certificate:     'RERA Certificate',
  title_deed:           'Title Deed',
  environmental_clearance: 'Environmental Clearance',
  bank_approval:        'Bank Approval',
  demand_letter:        'Demand Letter',
  agreement_template:   'Agreement Template',
  sale_deed_template:   'Sale Deed Template',
  brochure:             'Brochure',
  price_list:           'Price List',
  other:                'Other',
}
