'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import type { LoanStage, DisbursementStatus } from '@/types/loans'

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

const isManager = (role: string) => ['admin', 'manager'].includes(role)

// ── Bank tie-ups ──────────────────────────────────────────────────────────

export async function createBankTieup(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('bank_tieups').insert({
    bank_name:         formData.get('bank_name') as string,
    loan_product_name: formData.get('loan_product_name') as string,
    max_loan_pct:      formData.get('max_loan_pct') ? parseFloat(formData.get('max_loan_pct') as string) : null,
    interest_rate:     formData.get('interest_rate') ? parseFloat(formData.get('interest_rate') as string) : null,
    interest_type:     formData.get('interest_type') as 'floating' | 'fixed' || 'floating',
    processing_fee:    formData.get('processing_fee') ? parseFloat(formData.get('processing_fee') as string) : null,
    processing_fee_pct: formData.get('processing_fee_pct') ? parseFloat(formData.get('processing_fee_pct') as string) : null,
    rm_name:           formData.get('rm_name') as string || null,
    rm_phone:          formData.get('rm_phone') as string || null,
    rm_email:          formData.get('rm_email') as string || null,
    turnaround_days:   formData.get('turnaround_days') ? parseInt(formData.get('turnaround_days') as string, 10) : null,
    notes:             formData.get('notes') as string || null,
    created_by:        auth.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/loans/banks')
  return { success: true }
}

export async function updateBankTieup(id: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('bank_tieups').update({
    bank_name:         formData.get('bank_name') as string,
    loan_product_name: formData.get('loan_product_name') as string,
    max_loan_pct:      formData.get('max_loan_pct') ? parseFloat(formData.get('max_loan_pct') as string) : null,
    interest_rate:     formData.get('interest_rate') ? parseFloat(formData.get('interest_rate') as string) : null,
    interest_type:     formData.get('interest_type') as 'floating' | 'fixed' || 'floating',
    processing_fee:    formData.get('processing_fee') ? parseFloat(formData.get('processing_fee') as string) : null,
    processing_fee_pct: formData.get('processing_fee_pct') ? parseFloat(formData.get('processing_fee_pct') as string) : null,
    rm_name:           formData.get('rm_name') as string || null,
    rm_phone:          formData.get('rm_phone') as string || null,
    rm_email:          formData.get('rm_email') as string || null,
    turnaround_days:   formData.get('turnaround_days') ? parseInt(formData.get('turnaround_days') as string, 10) : null,
    notes:             formData.get('notes') as string || null,
    updated_at:        new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/loans/banks')
  return { success: true }
}

export async function toggleBankTieup(id: string, isActive: boolean) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }
  const { error } = await auth.supabase.from('bank_tieups')
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/loans/banks')
  return { success: true }
}

// ── DSAs ──────────────────────────────────────────────────────────────────

export async function createDSA(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const empanelments = (formData.get('bank_empanelments') as string || '').split(',').map(s => s.trim()).filter(Boolean)

  const { error } = await auth.supabase.from('dsas').insert({
    name:              formData.get('name') as string,
    firm_name:         formData.get('firm_name') as string || null,
    bank_empanelments: empanelments,
    contact_phone:     formData.get('contact_phone') as string || null,
    contact_email:     formData.get('contact_email') as string || null,
    city:              formData.get('city') as string || null,
    commission_rate:   formData.get('commission_rate') ? parseFloat(formData.get('commission_rate') as string) : null,
    notes:             formData.get('notes') as string || null,
    created_by:        auth.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/loans/dsas')
  return { success: true }
}

export async function updateDSA(id: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const empanelments = (formData.get('bank_empanelments') as string || '').split(',').map(s => s.trim()).filter(Boolean)

  const { error } = await auth.supabase.from('dsas').update({
    name:              formData.get('name') as string,
    firm_name:         formData.get('firm_name') as string || null,
    bank_empanelments: empanelments,
    contact_phone:     formData.get('contact_phone') as string || null,
    contact_email:     formData.get('contact_email') as string || null,
    city:              formData.get('city') as string || null,
    commission_rate:   formData.get('commission_rate') ? parseFloat(formData.get('commission_rate') as string) : null,
    notes:             formData.get('notes') as string || null,
    updated_at:        new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/loans/dsas')
  return { success: true }
}

export async function toggleDSA(id: string, isActive: boolean) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }
  const { error } = await auth.supabase.from('dsas')
    .update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/loans/dsas')
  return { success: true }
}

// ── Loan applications ─────────────────────────────────────────────────────

export async function createLoanApplication(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { data, error } = await auth.supabase.from('loan_applications').insert({
    client_id:    formData.get('client_id') as string,
    booking_id:   formData.get('booking_id') as string || null,
    bank_tieup_id: formData.get('bank_tieup_id') as string || null,
    dsa_id:       formData.get('dsa_id') as string || null,
    stage:        'eligibility_check',
    monthly_income:  formData.get('monthly_income') ? parseFloat(formData.get('monthly_income') as string) : null,
    existing_emis:   formData.get('existing_emis') ? parseFloat(formData.get('existing_emis') as string) : null,
    credit_score:    formData.get('credit_score') ? parseInt(formData.get('credit_score') as string, 10) : null,
    loan_amount_applied: formData.get('loan_amount_applied') ? parseFloat(formData.get('loan_amount_applied') as string) : null,
    notes:        formData.get('notes') as string || null,
    created_by:   auth.userId,
  }).select('id').single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed' }
  revalidatePath('/loans')
  revalidatePath(`/clients/${formData.get('client_id')}`)
  return { success: true, id: data.id }
}

export async function updateLoanStage(loanId: string, stage: LoanStage, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const update: Record<string, unknown> = {
    stage,
    updated_at: new Date().toISOString(),
  }

  // Stage-specific fields
  if (stage === 'bank_selected') {
    update.bank_tieup_id    = formData.get('bank_tieup_id') || null
    update.dsa_id           = formData.get('dsa_id') || null
    update.rm_contacted_date = formData.get('rm_contacted_date') || null
  }
  if (stage === 'application_submitted') {
    update.loan_amount_applied = formData.get('loan_amount_applied') ? parseFloat(formData.get('loan_amount_applied') as string) : null
    update.application_date    = formData.get('application_date') || null
    update.processing_fee_paid = formData.get('processing_fee_paid') ? parseFloat(formData.get('processing_fee_paid') as string) : null
  }
  if (stage === 'sanction_received') {
    update.sanctioned_amount        = formData.get('sanctioned_amount') ? parseFloat(formData.get('sanctioned_amount') as string) : null
    update.sanctioned_interest_rate = formData.get('sanctioned_interest_rate') ? parseFloat(formData.get('sanctioned_interest_rate') as string) : null
    update.sanctioned_tenure_months = formData.get('sanctioned_tenure_months') ? parseInt(formData.get('sanctioned_tenure_months') as string, 10) : null
    update.sanction_date            = formData.get('sanction_date') || null
  }
  if (stage === 'rejected') {
    update.rejection_date       = formData.get('rejection_date') || null
    update.rejection_reason     = formData.get('rejection_reason') || null
    update.alternate_bank_tried = formData.get('alternate_bank_tried') || null
  }

  const { data: loan } = await auth.supabase.from('loan_applications').select('client_id').eq('id', loanId).single()
  const { error } = await auth.supabase.from('loan_applications').update(update).eq('id', loanId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/loans/${loanId}`)
  revalidatePath('/loans')
  if (loan?.client_id) revalidatePath(`/clients/${loan.client_id}`)
  return { success: true }
}

export async function updateLoanDocs(loanId: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { error } = await auth.supabase.from('loan_applications').update({
    doc_income_proof:  formData.get('doc_income_proof') === 'true',
    doc_kyc:           formData.get('doc_kyc') === 'true',
    doc_property_docs: formData.get('doc_property_docs') === 'true',
    doc_noc:           formData.get('doc_noc') === 'true',
    doc_bank_statement: formData.get('doc_bank_statement') === 'true',
    doc_itr:           formData.get('doc_itr') === 'true',
    updated_at:        new Date().toISOString(),
  }).eq('id', loanId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/loans/${loanId}`)
  return { success: true }
}

export async function updateLoanNotes(loanId: string, notes: string) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }
  const { error } = await auth.supabase.from('loan_applications')
    .update({ notes, updated_at: new Date().toISOString() }).eq('id', loanId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/loans/${loanId}`)
  return { success: true }
}

// ── Disbursements ─────────────────────────────────────────────────────────

export async function addDisbursementTranche(loanId: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await auth.supabase
    .from('loan_disbursements')
    .select('tranche_number')
    .eq('loan_application_id', loanId)
    .order('tranche_number', { ascending: false })
    .limit(1)
    .single()

  const nextTranche = (existing?.tranche_number ?? 0) + 1

  const { error } = await auth.supabase.from('loan_disbursements').insert({
    loan_application_id: loanId,
    milestone_id:        formData.get('milestone_id') as string || null,
    tranche_number:      nextTranche,
    expected_amount:     parseFloat(formData.get('expected_amount') as string),
    expected_date:       formData.get('expected_date') as string || null,
    notes:               formData.get('notes') as string || null,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/loans/${loanId}`)
  return { success: true }
}

export async function updateDisbursementStatus(
  disbId: string,
  loanId: string,
  status: DisbursementStatus,
  formData: FormData,
) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'received') {
    update.actual_amount   = formData.get('actual_amount') ? parseFloat(formData.get('actual_amount') as string) : null
    update.actual_date     = formData.get('actual_date') || null
    update.bank_reference  = formData.get('bank_reference') as string || null
  }

  const { error } = await auth.supabase.from('loan_disbursements').update(update).eq('id', disbId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/loans/${loanId}`)
  revalidatePath('/loans')
  return { success: true }
}
