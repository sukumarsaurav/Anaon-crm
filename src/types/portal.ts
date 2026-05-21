import type { Client, Payment, ClientDocument, Complaint } from './clients'
import type { BookingFull } from './bookings'

export interface PortalSession {
  id: string
  client_id: string
  token: string
  expires_at: string
  created_at: string
}

export interface ConstructionUpdate {
  id: string
  project_id: string
  title: string
  description: string | null
  milestone: string | null
  percentage_complete: number
  photos: string[]
  update_date: string
  posted_by: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  // joined
  poster?: { id: string; full_name: string } | null
}

export interface PaymentExtensionRequest {
  id: string
  client_id: string
  payment_id: string
  booking_id: string
  reason: string
  requested_date: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // joined
  payment?: { id: string; installment_number: number; amount_due: number; due_date: string } | null
  reviewer?: { id: string; full_name: string } | null
}

export interface PortalClientData {
  client: Client
  booking: BookingFull | null
  payments: Payment[]
  documents: ClientDocument[]
  complaints: Complaint[]
  constructionUpdates: ConstructionUpdate[]
  paymentSummary: {
    total_due: number
    total_paid: number
    outstanding: number
    overdue_count: number
    next_due_date: string | null
    next_due_amount: number | null
  }
}

// ── Display config ──────────────────────────────────────────────────
export const EXTENSION_STATUS_CONFIG: Record<PaymentExtensionRequest['status'], {
  label: string; color: string; bg: string
}> = {
  pending:  { label: 'Pending',  color: 'text-amber-700',  bg: 'bg-amber-50'  },
  approved: { label: 'Approved', color: 'text-green-700',  bg: 'bg-green-50'  },
  rejected: { label: 'Rejected', color: 'text-red-700',    bg: 'bg-red-50'    },
}
