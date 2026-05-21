import type { Payment, PaymentSummary } from './clients'

export type BookingStatus    = 'pending_approval' | 'confirmed' | 'cancelled'
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'voided'
export type PaymentPlanType  = 'down_payment' | 'construction_linked' | 'subvention' | 'custom'
export type ReferredBySource = 'broker' | 'client' | 'campaign' | 'walk_in' | 'self'

export interface BookingFull {
  id: string
  booking_number: string
  client_id: string
  plot_id: string
  project_id: string
  total_sale_value: number
  booking_amount: number
  payment_plan: string | null
  payment_plan_type: PaymentPlanType
  advisor_id: string | null
  manager_id: string | null
  broker_id: string | null
  broker_commission_pct: number | null
  broker_commission_amount: number | null
  booking_date: string
  agreement_date: string | null
  expected_possession_date: string | null
  status: BookingStatus
  approved_by: string | null
  approved_at: string | null
  approval_notes: string | null
  cancellation_reason: string | null
  cancellation_date: string | null
  cancellation_charges: number | null
  allotment_letter_url: string | null
  allotment_letter_sent_at: string | null
  agreement_url: string | null
  agreement_signed: boolean
  booking_form_url: string | null
  referred_by_source: ReferredBySource | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: {
    id: string; full_name: string; phone: string; email: string | null
    pan_encrypted: string | null; permanent_address: string | null
  } | null
  plot?: {
    id: string; plot_number: string; size_sqyd: number | null; size_sqft: number | null
    facing: string | null; type: string; base_price: number; total_price: number | null
  } | null
  project?: {
    id: string; name: string; city: string; type: string
    rera_number: string | null; address: string | null
  } | null
  advisor?: { id: string; full_name: string; phone: string | null } | null
  approver?: { id: string; full_name: string } | null
  broker?: { id: string; full_name: string; firm_name: string | null; commission_rate: number } | null
}

export interface BookingStats {
  total: number
  pending_approval: number
  confirmed: number
  cancelled: number
  total_value: number
  total_collected: number
}

export interface BrokerCommission {
  id: string
  broker_id: string
  booking_id: string
  booking_value: number
  commission_pct: number | null
  commission_amount: number | null
  status: CommissionStatus
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  utr_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Data shapes for printable documents
export interface AllotmentLetterData {
  booking: BookingFull
  generated_at: string
}

export interface DemandLetterData {
  booking: BookingFull
  payment: Payment
  generated_at: string
  bank_name:    string
  account_number: string
  ifsc:         string
  late_charge_pct: number  // per day % after due
}

// ── Display config ──────────────────────────────────────────────
export const BOOKING_STATUS_CONFIG: Record<BookingStatus, {
  label: string; color: string; bg: string; border: string
}> = {
  pending_approval: { label: 'Pending Approval', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  confirmed:        { label: 'Confirmed',         color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  cancelled:        { label: 'Cancelled',         color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'   },
}

export const PAYMENT_PLAN_LABELS: Record<PaymentPlanType, string> = {
  down_payment:        'Down Payment Plan',
  construction_linked: 'Construction-Linked Plan',
  subvention:          'Subvention Scheme',
  custom:              'Custom Installment Plan',
}

export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-700',  bg: 'bg-amber-50'  },
  approved: { label: 'Approved', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  paid:     { label: 'Paid',     color: 'text-green-700',  bg: 'bg-green-50'  },
  voided:   { label: 'Voided',   color: 'text-gray-500',   bg: 'bg-gray-100'  },
}

export const REFERRED_BY_LABELS: Record<ReferredBySource, string> = {
  broker:   'Channel Partner / Broker',
  client:   'Existing Client Referral',
  campaign: 'Marketing Campaign',
  walk_in:  'Walk-in',
  self:     'Self / Direct',
}
