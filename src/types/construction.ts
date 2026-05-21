export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed'

export interface ConstructionMilestone {
  id: string
  project_id: string
  name: string
  description: string | null
  payment_percentage: number
  sequence_order: number
  expected_date: string | null
  actual_completion_date: string | null
  completion_percentage: number
  status: MilestoneStatus
  photos: string[]
  notes: string | null
  is_payment_trigger: boolean
  completed_by: string | null
  delay_reason: string | null
  revised_expected_date: string | null
  delay_noted_by: string | null
  delay_noted_at: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  completer?: { id: string; full_name: string } | null
  updater?: { id: string; full_name: string } | null
}

export interface ConstructionProjectSummary {
  id: string
  name: string
  city: string
  type: string
  status: string
  milestone_count: number
  completed_count: number
  delayed_count: number
  in_progress_count: number
  overall_percentage: number
  current_milestone: ConstructionMilestone | null
  next_milestone: ConstructionMilestone | null
}

export interface ConstructionDashboardData {
  projects: ConstructionProjectSummary[]
  total_delayed: number
  total_in_progress: number
  delayed_milestones: (ConstructionMilestone & { project_name: string; project_city: string })[]
  recent_completions: (ConstructionMilestone & { project_name: string; project_city: string })[]
}

export const MILESTONE_STATUS_CONFIG: Record<MilestoneStatus, {
  label: string; color: string; bg: string; border: string; dot: string
}> = {
  pending:     { label: 'Pending',      color: 'text-gray-500',  bg: 'bg-gray-50',   border: 'border-gray-200', dot: 'bg-gray-300'   },
  in_progress: { label: 'In Progress',  color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200', dot: 'bg-blue-500'   },
  completed:   { label: 'Completed',    color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200',dot: 'bg-green-500'  },
  delayed:     { label: 'Delayed',      color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200',  dot: 'bg-red-500'    },
}

export const DEFAULT_PLOTTED_MILESTONES: Array<{ name: string; payment_percentage: number; sequence_order: number; description: string }> = [
  { name: 'Booking',                    payment_percentage: 10, sequence_order: 1, description: 'At the time of booking' },
  { name: 'Plot demarcation',           payment_percentage: 10, sequence_order: 2, description: 'Individual plots marked on ground' },
  { name: 'Boundary wall completion',   payment_percentage: 15, sequence_order: 3, description: 'Perimeter wall completed' },
  { name: 'Internal roads (base layer)',payment_percentage: 15, sequence_order: 4, description: 'Road foundation laid' },
  { name: 'Underground utilities',      payment_percentage: 10, sequence_order: 5, description: 'Water, drainage, electricity lines laid' },
  { name: 'Road surfacing',             payment_percentage: 10, sequence_order: 6, description: 'Tarmac / concrete road complete' },
  { name: 'Street lighting',            payment_percentage: 5,  sequence_order: 7, description: 'Poles and lights installed' },
  { name: 'Landscaping',                payment_percentage: 5,  sequence_order: 8, description: 'Parks, green areas developed' },
  { name: 'Possession',                 payment_percentage: 20, sequence_order: 9, description: 'Final demand and possession handover' },
]
