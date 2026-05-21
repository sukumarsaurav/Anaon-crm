export type LegalDocumentType =
  | 'booking_form'
  | 'ats'                 // Agreement to Sale
  | 'allotment_letter'
  | 'demand_letter'
  | 'cancellation_letter'
  | 'possession_letter'
  | 'handover_checklist'
  | 'noc_bank'
  | 'other'

export type DeletionRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

export interface LegalDocumentTemplate {
  id: string
  name: string
  type: LegalDocumentType
  description: string | null
  file_url: string | null
  version: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: { full_name: string } | null
}

export interface DataDeletionRequest {
  id: string
  requester_type: 'lead' | 'client'
  requester_id: string | null
  requester_name: string
  requester_phone: string | null
  requester_email: string | null
  reason: string | null
  status: DeletionRequestStatus
  admin_notes: string | null
  requested_at: string
  completed_at: string | null
  processed_by: string | null
  processor?: { full_name: string } | null
}

export interface ConsentLog {
  id: string
  entity_type: 'lead' | 'client'
  entity_id: string
  entity_name: string | null
  consent_type: string
  consented: boolean
  ip_address: string | null
  source: string
  created_at: string
}

// RERA compliance check result per project
export interface RERAComplianceStatus {
  projectId: string
  projectName: string
  reraNumber: string | null
  reraExpiryDate: string | null
  daysUntilExpiry: number | null  // negative = already expired
  hasRERADoc: boolean
  hasTitleDeed: boolean
  hasLayoutApproval: boolean
  hasFireNOC: boolean
  hasBankApproval: boolean
  hasEnvClearance: boolean
  complianceScore: number   // 0-100
  quarterlyReportDue: boolean
  alertLevel: 'ok' | 'warning' | 'critical'
}

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  booking_form:        'Booking Form',
  ats:                 'Agreement to Sale (RERA Format)',
  allotment_letter:    'Allotment Letter',
  demand_letter:       'Demand Letter',
  cancellation_letter: 'Cancellation Letter',
  possession_letter:   'Possession Letter',
  handover_checklist:  'Handover Checklist',
  noc_bank:            'NOC for Bank Loan',
  other:               'Other',
}

export const LEGAL_DOCUMENT_TYPES: LegalDocumentType[] = [
  'booking_form', 'ats', 'allotment_letter', 'demand_letter',
  'cancellation_letter', 'possession_letter', 'handover_checklist', 'noc_bank', 'other',
]

// RERA compliance checklist items per project (maps to DocumentCategory)
export const RERA_CHECKLIST_ITEMS: { key: string; label: string; required: boolean }[] = [
  { key: 'rera_certificate',       label: 'RERA Registration Certificate',  required: true },
  { key: 'title_deed',             label: 'Clear Title Report / Title Deed', required: true },
  { key: 'layout_approval',        label: 'Layout Approval from Authority',  required: true },
  { key: 'noc',                    label: 'Fire NOC',                        required: true },
  { key: 'bank_approval',          label: 'Bank Loan Tie-up Approval',       required: false },
  { key: 'environmental_clearance',label: 'Environmental Clearance',         required: false },
]

export const DELETION_STATUS_CONFIG: Record<DeletionRequestStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700', bg: 'bg-amber-50' },
  in_progress: { label: 'In Progress', color: 'text-blue-700',  bg: 'bg-blue-50' },
  completed:   { label: 'Completed',   color: 'text-green-700', bg: 'bg-green-50' },
  rejected:    { label: 'Rejected',    color: 'text-red-700',   bg: 'bg-red-50' },
}

export const CONSENT_TYPES: { value: string; label: string }[] = [
  { value: 'marketing_whatsapp', label: 'WhatsApp Marketing' },
  { value: 'marketing_email',    label: 'Email Marketing' },
  { value: 'data_storage',       label: 'Personal Data Storage' },
  { value: 'site_visit_photos',  label: 'Site Visit Photography' },
]
