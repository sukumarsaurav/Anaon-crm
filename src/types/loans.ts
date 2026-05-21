export type LoanStage =
  | 'eligibility_check'
  | 'bank_selected'
  | 'application_submitted'
  | 'docs_submitted'
  | 'sanction_received'
  | 'disbursement'
  | 'rejected'

export type DisbursementStatus = 'pending' | 'received' | 'delayed'

export interface BankTieup {
  id: string
  bank_name: string
  loan_product_name: string
  applicable_projects: string[] | null
  max_loan_pct: number | null
  interest_rate: number | null
  interest_type: 'floating' | 'fixed'
  processing_fee: number | null
  processing_fee_pct: number | null
  rm_name: string | null
  rm_phone: string | null
  rm_email: string | null
  turnaround_days: number | null
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DSA {
  id: string
  name: string
  firm_name: string | null
  bank_empanelments: string[]
  contact_phone: string | null
  contact_email: string | null
  city: string | null
  commission_rate: number | null
  is_active: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  loan_count?: number
}

export interface LoanApplication {
  id: string
  client_id: string
  booking_id: string | null
  bank_tieup_id: string | null
  dsa_id: string | null
  stage: LoanStage

  // Eligibility
  monthly_income: number | null
  existing_emis: number | null
  credit_score: number | null

  // Application
  rm_contacted_date: string | null
  loan_amount_applied: number | null
  application_date: string | null
  processing_fee_paid: number | null
  processing_fee_date: string | null

  // Docs
  doc_income_proof: boolean
  doc_kyc: boolean
  doc_property_docs: boolean
  doc_noc: boolean
  doc_bank_statement: boolean
  doc_itr: boolean

  // Sanction
  sanctioned_amount: number | null
  sanctioned_interest_rate: number | null
  sanctioned_tenure_months: number | null
  sanction_date: string | null

  // Rejection
  rejection_date: string | null
  rejection_reason: string | null
  alternate_bank_tried: string | null

  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string

  // Joined
  client?: { id: string; full_name: string; phone: string } | null
  bank?: BankTieup | null
  dsa?: DSA | null
  disbursements?: LoanDisbursement[]
}

export interface LoanDisbursement {
  id: string
  loan_application_id: string
  milestone_id: string | null
  tranche_number: number
  expected_amount: number
  actual_amount: number | null
  expected_date: string | null
  actual_date: string | null
  status: DisbursementStatus
  bank_reference: string | null
  notes: string | null
  created_at: string
  updated_at: string
  milestone?: { name: string } | null
}

// ── Stage config ───────────────────────────────────────────────────────────

export const LOAN_STAGES: { value: LoanStage; label: string; color: string; bg: string; step: number }[] = [
  { value: 'eligibility_check',     label: 'Eligibility Check',    color: 'text-gray-700',   bg: 'bg-gray-100',   step: 1 },
  { value: 'bank_selected',         label: 'Bank Selected',         color: 'text-blue-700',   bg: 'bg-blue-50',    step: 2 },
  { value: 'application_submitted', label: 'Application Submitted', color: 'text-indigo-700', bg: 'bg-indigo-50',  step: 3 },
  { value: 'docs_submitted',        label: 'Docs Submitted',        color: 'text-purple-700', bg: 'bg-purple-50',  step: 4 },
  { value: 'sanction_received',     label: 'Sanction Received',     color: 'text-green-700',  bg: 'bg-green-50',   step: 5 },
  { value: 'disbursement',          label: 'Disbursement',          color: 'text-teal-700',   bg: 'bg-teal-50',    step: 6 },
  { value: 'rejected',              label: 'Rejected',              color: 'text-red-700',    bg: 'bg-red-50',     step: 0 },
]

export const DISBURSEMENT_STATUS_CONFIG: Record<DisbursementStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-700', bg: 'bg-amber-50' },
  received: { label: 'Received', color: 'text-green-700', bg: 'bg-green-50' },
  delayed:  { label: 'Delayed',  color: 'text-red-700',   bg: 'bg-red-50' },
}

export const LOAN_DOC_CHECKLIST: { key: keyof Pick<LoanApplication,
  'doc_income_proof'|'doc_kyc'|'doc_property_docs'|'doc_noc'|'doc_bank_statement'|'doc_itr'>; label: string }[] = [
  { key: 'doc_income_proof',   label: 'Income Proof (Salary Slip / P&L)' },
  { key: 'doc_kyc',            label: 'KYC Documents (PAN + Aadhaar)' },
  { key: 'doc_property_docs',  label: 'Property Documents (Title, Layout)' },
  { key: 'doc_noc',            label: 'NOC from Builder' },
  { key: 'doc_bank_statement', label: 'Bank Statement (6 months)' },
  { key: 'doc_itr',            label: 'ITR (2 years)' },
]
