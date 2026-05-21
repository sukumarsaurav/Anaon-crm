import type { CommissionStatus } from './bookings'

export type BrokerStatus = 'pending' | 'approved' | 'rejected' | 'inactive'

export interface Broker {
  id: string
  full_name: string
  firm_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  rera_number: string | null
  commission_rate: number
  bank_name: string | null
  account_number: string | null
  ifsc: string | null
  gstin: string | null
  status: BrokerStatus
  auth_user_id: string | null
  invited_by: string | null
  approved_by: string | null
  rejected_reason: string | null
  onboarded_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BrokerWithStats extends Broker {
  total_leads: number
  total_bookings: number
  total_commission_earned: number
  total_commission_pending: number
  conversion_rate: number
}

export interface BrokerStats {
  total_leads: number
  total_bookings: number
  commission_earned: number
  commission_pending: number
  commission_paid: number
  conversion_rate: number
  active_since: string | null
}

export interface BrokerLeadRegistration {
  id: string
  broker_id: string
  client_name: string
  client_phone: string
  project_id: string | null
  budget_min: number | null
  budget_max: number | null
  notes: string | null
  status: 'registered' | 'duplicate' | 'converted' | 'lost'
  crm_lead_id: string | null
  duplicate_of_lead_id: string | null
  created_at: string
  updated_at: string
  // joined
  project?: { id: string; name: string; city: string } | null
}

export interface BrokerCommissionRow {
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
  // joined
  broker?: { id: string; full_name: string; firm_name: string | null } | null
  booking?: { id: string; booking_number: string } | null
}

// ── Display config ──────────────────────────────────────────────────
export const BROKER_STATUS_CONFIG: Record<BrokerStatus, {
  label: string; color: string; bg: string; border: string
}> = {
  pending:  { label: 'Pending',  color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
  rejected: { label: 'Rejected', color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200'   },
  inactive: { label: 'Inactive', color: 'text-gray-500',  bg: 'bg-gray-100',  border: 'border-gray-200'  },
}

export const LEAD_REG_STATUS_CONFIG: Record<BrokerLeadRegistration['status'], {
  label: string; color: string; bg: string
}> = {
  registered: { label: 'Registered', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  duplicate:  { label: 'Duplicate',  color: 'text-amber-700',  bg: 'bg-amber-50'  },
  converted:  { label: 'Converted',  color: 'text-green-700',  bg: 'bg-green-50'  },
  lost:       { label: 'Lost',       color: 'text-gray-500',   bg: 'bg-gray-100'  },
}
