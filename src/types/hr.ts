export type CandidateStage =
  | 'applied' | 'shortlisted' | 'interview_scheduled'
  | 'interview_done' | 'offer' | 'joined' | 'rejected'

export type LeaveType = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type PayrollStatus = 'draft' | 'processing' | 'completed' | 'cancelled'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'

export interface Candidate {
  id: string
  listing_id: string | null
  name: string
  phone: string
  email: string | null
  resume_url: string | null
  cover_letter: string | null
  stage: CandidateStage
  status: string
  current_company: string | null
  current_ctc: number | null
  expected_ctc: number | null
  experience_years: number | null
  interview_date: string | null
  interviewer_id: string | null
  interview_mode: string | null
  interview_rating: number | null
  interview_feedback: string | null
  offer_ctc: number | null
  offer_date: string | null
  joining_date: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  updated_at: string
  created_at: string
  listing?: { title: string } | null
  interviewer?: { full_name: string } | null
}

export interface HREmployee {
  id: string
  full_name: string
  phone: string
  email: string | null
  role: string
  designation: string | null
  department: string | null
  employee_id: string | null
  joining_date: string | null
  probation_end_date: string | null
  employment_type: EmploymentType | null
  base_salary: number | null
  reporting_manager_id: string | null
  photo_url: string | null
  is_active: boolean
  aadhar_number: string | null
  pan_number: string | null
  bank_name: string | null
  bank_account: string | null
  bank_ifsc: string | null
  emergency_contact: string | null
  address: string | null
  termination_date: string | null
  date_of_birth: string | null
  created_at: string
  manager?: { full_name: string } | null
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
  employee?: { full_name: string; designation: string | null; photo_url: string | null } | null
  reviewer?: { full_name: string } | null
}

export interface LeaveBalance {
  id: string
  user_id: string
  year: number
  leave_type: LeaveType
  entitled: number
  used: number
  employee?: { full_name: string } | null
}

export interface AttendanceLog {
  id: string
  user_id: string
  date: string
  check_in_at: string | null
  check_out_at: string | null
  status: string
  notes: string | null
  employee?: { full_name: string; designation: string | null } | null
}

export interface PayrollRun {
  id: string
  year: number
  month: number
  status: PayrollStatus
  total_gross: number
  total_deductions: number
  total_net: number
  total_employees: number
  notes: string | null
  processed_by: string | null
  processed_at: string | null
  created_at: string
  processor?: { full_name: string } | null
}

export interface PayrollSlip {
  id: string
  run_id: string
  user_id: string
  working_days: number
  present_days: number
  lop_days: number
  basic: number
  hra: number
  allowances: number
  incentives: number
  gross: number
  pf_employee: number
  pf_employer: number
  professional_tax: number
  tds: number
  total_deductions: number
  net_pay: number
  slip_url: string | null
  created_at: string
  employee?: { full_name: string; designation: string | null; employee_id: string | null } | null
}

export const CANDIDATE_STAGES: { value: CandidateStage; label: string; color: string; bg: string }[] = [
  { value: 'applied',              label: 'Applied',             color: 'text-gray-700',   bg: 'bg-gray-100' },
  { value: 'shortlisted',          label: 'Shortlisted',         color: 'text-blue-700',   bg: 'bg-blue-50' },
  { value: 'interview_scheduled',  label: 'Interview Scheduled', color: 'text-amber-700',  bg: 'bg-amber-50' },
  { value: 'interview_done',       label: 'Interview Done',      color: 'text-purple-700', bg: 'bg-purple-50' },
  { value: 'offer',                label: 'Offer',               color: 'text-indigo-700', bg: 'bg-indigo-50' },
  { value: 'joined',               label: 'Joined',              color: 'text-green-700',  bg: 'bg-green-50' },
  { value: 'rejected',             label: 'Rejected',            color: 'text-red-700',    bg: 'bg-red-50' },
]

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'casual',     label: 'Casual Leave' },
  { value: 'sick',       label: 'Sick Leave' },
  { value: 'earned',     label: 'Earned Leave' },
  { value: 'maternity',  label: 'Maternity Leave' },
  { value: 'paternity',  label: 'Paternity Leave' },
  { value: 'unpaid',     label: 'Unpaid Leave' },
]

export const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
