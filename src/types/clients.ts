// ── Enums ──────────────────────────────────────────────────────
export type KycStatus       = 'pending' | 'verified' | 'rejected'
export type BookingStatus   = 'pending_approval' | 'confirmed' | 'cancelled'
export type PaymentStatus   = 'pending' | 'paid' | 'overdue' | 'waived'
export type PaymentMode     = 'neft' | 'rtgs' | 'upi' | 'cheque' | 'demand_draft' | 'cash' | 'online'
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'escalated'
export type ComplaintPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ComplaintCategory =
  | 'payment_dispute' | 'document_issue' | 'construction_delay'
  | 'quality_issue'   | 'billing_error'  | 'possession_delay' | 'other'
export type OccupationType = 'salaried' | 'self_employed' | 'business' | 'retired' | 'other'
export type DocStatus = 'pending' | 'uploaded' | 'verified' | 'rejected'
export type DocType =
  | 'aadhar' | 'pan' | 'photo' | 'address_proof'
  | 'booking_form' | 'allotment_letter' | 'agreement_to_sale'
  | 'sale_deed' | 'noc_loan' | 'possession_letter' | 'handover_checklist' | 'other'

// ── Core interfaces ────────────────────────────────────────────
export interface Client {
  id: string
  lead_id: string | null
  full_name: string
  date_of_birth: string | null
  pan_encrypted: string | null
  aadhar_encrypted: string | null
  phone: string
  alternate_phone: string | null
  email: string | null
  permanent_address: string | null
  communication_address: string | null
  photo_url: string | null
  occupation_type: OccupationType | null
  company_name: string | null
  monthly_income: number | null
  annual_income: number | null
  kyc_status: KycStatus
  kyc_aadhar_submitted: boolean
  kyc_pan_submitted: boolean
  kyc_photo_submitted: boolean
  kyc_address_proof_submitted: boolean
  // Co-applicant
  co_applicant_name: string | null
  co_applicant_relationship: string | null
  co_applicant_phone: string | null
  co_applicant_pan_encrypted: string | null
  co_applicant_aadhar_encrypted: string | null
  // Nominee
  nominee_name: string | null
  nominee_relationship: string | null
  nominee_dob: string | null
  nominee_phone: string | null
  portal_user_id: string | null
  whatsapp_opt_in: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  booking_number: string
  client_id: string
  plot_id: string
  project_id: string
  total_sale_value: number
  booking_amount: number
  payment_plan: string | null
  advisor_id: string | null
  manager_id: string | null
  broker_id: string | null
  broker_commission_pct: number | null
  broker_commission_amount: number | null
  booking_date: string
  agreement_date: string | null
  expected_possession_date: string | null
  status: BookingStatus
  cancellation_reason: string | null
  cancellation_date: string | null
  cancellation_charges: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  plot?: { id: string; plot_number: string; size_sqyd: number | null; size_sqft: number | null; facing: string | null } | null
  project?: { id: string; name: string; city: string; type: string } | null
  advisor?: { id: string; full_name: string } | null
}

export interface Payment {
  id: string
  booking_id: string
  client_id: string
  installment_number: number
  description: string | null
  amount_due: number
  due_date: string
  amount_paid: number
  paid_date: string | null
  mode: PaymentMode | null
  transaction_id: string | null
  cheque_number: string | null
  bank_name: string | null
  payment_reference: string | null
  status: PaymentStatus
  late_charge: number
  receipt_url: string | null
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientDocument {
  id: string
  client_id: string
  booking_id: string | null
  name: string | null
  document_type: DocType
  file_url: string | null
  status: DocStatus
  uploaded_by: string | null
  verified_by: string | null
  expiry_date: string | null
  notes: string | null
  created_at: string
  // Joined
  uploader?: { id: string; full_name: string } | null
  verifier?: { id: string; full_name: string } | null
}

export interface Complaint {
  id: string
  ticket_number: string
  client_id: string
  booking_id: string | null
  category: ComplaintCategory
  priority: ComplaintPriority
  description: string
  photo_urls: string[]
  status: ComplaintStatus
  assigned_to: string | null
  resolved_at: string | null
  resolution_notes: string | null
  satisfaction_rating: number | null
  created_at: string
  updated_at: string
  // Joined
  assignee?: { id: string; full_name: string } | null
}

// ── Computed summary ───────────────────────────────────────────
export interface PaymentSummary {
  total_due: number
  total_paid: number
  outstanding: number
  overdue_count: number
  next_due_date: string | null
  next_due_amount: number | null
}

// Timeline event (merged feed)
export interface TimelineEvent {
  id: string
  type: 'activity' | 'visit' | 'payment' | 'document' | 'complaint' | 'whatsapp'
  date: string
  title: string
  description: string | null
  meta?: Record<string, string | number | boolean | null>
}

// ── Display config ─────────────────────────────────────────────
export const KYC_STATUS_CONFIG: Record<KycStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'KYC Pending',  color: 'text-amber-700', bg: 'bg-amber-50' },
  verified: { label: 'KYC Verified', color: 'text-green-700', bg: 'bg-green-50' },
  rejected: { label: 'KYC Rejected', color: 'text-red-700',   bg: 'bg-red-50'   },
}

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50' },
  confirmed:        { label: 'Confirmed',         color: 'text-green-700', bg: 'bg-green-50' },
  cancelled:        { label: 'Cancelled',         color: 'text-red-700',   bg: 'bg-red-50'   },
}

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
  paid:    { label: 'Paid',    color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
  overdue: { label: 'Overdue', color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200'   },
  waived:  { label: 'Waived',  color: 'text-gray-500',  bg: 'bg-gray-100',  border: 'border-gray-200'  },
}

export const COMPLAINT_STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: 'text-red-700',    bg: 'bg-red-50'    },
  in_progress: { label: 'In Progress', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  resolved:    { label: 'Resolved',    color: 'text-green-700',  bg: 'bg-green-50'  },
  escalated:   { label: 'Escalated',   color: 'text-purple-700', bg: 'bg-purple-50' },
}

export const COMPLAINT_PRIORITY_CONFIG: Record<ComplaintPriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-gray-500'  },
  normal: { label: 'Normal', color: 'text-blue-600'  },
  high:   { label: 'High',   color: 'text-amber-600' },
  urgent: { label: 'Urgent', color: 'text-red-600'   },
}

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  payment_dispute:    'Payment Dispute',
  document_issue:     'Document Issue',
  construction_delay: 'Construction Delay',
  quality_issue:      'Quality Issue',
  billing_error:      'Billing Error',
  possession_delay:   'Possession Delay',
  other:              'Other',
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  aadhar:            'Aadhar Card',
  pan:               'PAN Card',
  photo:             'Photograph',
  address_proof:     'Address Proof',
  booking_form:      'Booking Form',
  allotment_letter:  'Allotment Letter',
  agreement_to_sale: 'Agreement to Sale',
  sale_deed:         'Sale Deed',
  noc_loan:          'NOC for Loan',
  possession_letter: 'Possession Letter',
  handover_checklist:'Handover Checklist',
  other:             'Other',
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  neft:         'NEFT',
  rtgs:         'RTGS',
  upi:          'UPI',
  cheque:       'Cheque',
  demand_draft: 'Demand Draft',
  cash:         'Cash',
  online:       'Online (Razorpay)',
}

export const OCCUPATION_LABELS: Record<OccupationType, string> = {
  salaried:     'Salaried',
  self_employed:'Self Employed',
  business:     'Business',
  retired:      'Retired',
  other:        'Other',
}
