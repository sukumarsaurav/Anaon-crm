'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { fireAutomations } from '@/lib/automation/engine'

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, error: 'Unauthorized', supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

function isManager(role: string) { return ['admin', 'manager'].includes(role) }

// ── Client CRUD ───────────────────────────────────────────────

export async function createClientProfile(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { data, error } = await auth.supabase.from('clients').insert({
    full_name:             formData.get('full_name') as string,
    phone:                 formData.get('phone') as string,
    alternate_phone:       formData.get('alternate_phone') as string || null,
    email:                 formData.get('email') as string || null,
    date_of_birth:         formData.get('date_of_birth') as string || null,
    pan_encrypted:         formData.get('pan') as string || null,
    aadhar_encrypted:      formData.get('aadhar') as string || null,
    permanent_address:     formData.get('permanent_address') as string || null,
    communication_address: formData.get('communication_address') as string || null,
    photo_url:             formData.get('photo_url') as string || null,
    occupation_type:       formData.get('occupation_type') as string || null,
    company_name:          formData.get('company_name') as string || null,
    monthly_income:        parseFloat(formData.get('monthly_income') as string) || null,
    annual_income:         parseFloat(formData.get('annual_income') as string) || null,
    // Co-applicant
    co_applicant_name:         formData.get('co_applicant_name') as string || null,
    co_applicant_relationship: formData.get('co_applicant_relationship') as string || null,
    co_applicant_phone:        formData.get('co_applicant_phone') as string || null,
    // Nominee
    nominee_name:         formData.get('nominee_name') as string || null,
    nominee_relationship: formData.get('nominee_relationship') as string || null,
    nominee_dob:          formData.get('nominee_dob') as string || null,
    nominee_phone:        formData.get('nominee_phone') as string || null,
    // Lead link
    lead_id:    formData.get('lead_id') as string || null,
    created_by: auth.userId,
  }).select('id').single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed' }
  revalidatePath('/clients')
  return { success: true, id: data.id }
}

export async function updateClientProfile(id: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { error } = await auth.supabase.from('clients').update({
    full_name:             formData.get('full_name') as string,
    phone:                 formData.get('phone') as string,
    alternate_phone:       formData.get('alternate_phone') as string || null,
    email:                 formData.get('email') as string || null,
    date_of_birth:         formData.get('date_of_birth') as string || null,
    pan_encrypted:         formData.get('pan') as string || null,
    aadhar_encrypted:      formData.get('aadhar') as string || null,
    permanent_address:     formData.get('permanent_address') as string || null,
    communication_address: formData.get('communication_address') as string || null,
    photo_url:             formData.get('photo_url') as string || null,
    occupation_type:       formData.get('occupation_type') as string || null,
    company_name:          formData.get('company_name') as string || null,
    monthly_income:        parseFloat(formData.get('monthly_income') as string) || null,
    annual_income:         parseFloat(formData.get('annual_income') as string) || null,
    co_applicant_name:         formData.get('co_applicant_name') as string || null,
    co_applicant_relationship: formData.get('co_applicant_relationship') as string || null,
    co_applicant_phone:        formData.get('co_applicant_phone') as string || null,
    nominee_name:         formData.get('nominee_name') as string || null,
    nominee_relationship: formData.get('nominee_relationship') as string || null,
    nominee_dob:          formData.get('nominee_dob') as string || null,
    nominee_phone:        formData.get('nominee_phone') as string || null,
    updated_at:           new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

// ── KYC ───────────────────────────────────────────────────────

export async function updateKycChecklist(clientId: string, field: string, value: boolean) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const allowed = ['kyc_aadhar_submitted', 'kyc_pan_submitted', 'kyc_photo_submitted', 'kyc_address_proof_submitted']
  if (!allowed.includes(field)) return { success: false, error: 'Invalid field' }

  const { error } = await auth.supabase.from('clients')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateKycStatus(clientId: string, status: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('clients')
    .update({ kyc_status: status, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

// ── Payments ──────────────────────────────────────────────────

export async function recordPayment(paymentId: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const amountPaid = parseFloat(formData.get('amount_paid') as string) || 0

  const { data: payment } = await auth.supabase
    .from('payments').select('client_id, amount_due, booking_id').eq('id', paymentId).single()

  const { error } = await auth.supabase.from('payments').update({
    amount_paid:       amountPaid,
    paid_date:         formData.get('paid_date') as string,
    mode:              formData.get('mode') as string || null,
    transaction_id:    formData.get('transaction_id') as string || null,
    cheque_number:     formData.get('cheque_number') as string || null,
    bank_name:         formData.get('bank_name') as string || null,
    payment_reference: formData.get('payment_reference') as string || null,
    status:            amountPaid > 0 ? 'paid' : 'pending',
    notes:             formData.get('notes') as string || null,
    verified_by:       auth.userId,
    verified_at:       new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  }).eq('id', paymentId)

  if (error) return { success: false, error: error.message }

  if (amountPaid > 0 && payment?.client_id) {
    const { data: clientData } = await auth.supabase.from('clients').select('full_name, phone').eq('id', payment.client_id).single()
    fireAutomations('payment_received', {
      payment: { id: paymentId, amount_due: payment.amount_due },
      client: clientData ? { id: payment.client_id, full_name: clientData.full_name, phone: clientData.phone } : undefined,
    }, 'payment', paymentId)
  }

  if (payment?.client_id) revalidatePath(`/clients/${payment.client_id}`)
  if (payment?.booking_id) revalidatePath(`/clients/${payment.client_id}/bookings/${payment.booking_id}/payments`)
  return { success: true }
}

export async function addPaymentInstallment(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const bookingId = formData.get('booking_id') as string
  const clientId  = formData.get('client_id') as string

  // Get next installment number
  const { count } = await auth.supabase
    .from('payments').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId)

  const { error } = await auth.supabase.from('payments').insert({
    booking_id:          bookingId,
    client_id:           clientId,
    installment_number:  (count ?? 0) + 1,
    description:         formData.get('description') as string || null,
    amount_due:          parseFloat(formData.get('amount_due') as string),
    due_date:            formData.get('due_date') as string,
    status:              'pending',
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function waivePayment(paymentId: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: payment } = await auth.supabase
    .from('payments').select('client_id').eq('id', paymentId).single()

  const { error } = await auth.supabase.from('payments')
    .update({ status: 'waived', updated_at: new Date().toISOString() })
    .eq('id', paymentId)

  if (error) return { success: false, error: error.message }
  if (payment?.client_id) revalidatePath(`/clients/${payment.client_id}`)
  return { success: true }
}

// ── Documents ─────────────────────────────────────────────────

export async function addClientDocument(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const clientId = formData.get('client_id') as string
  const { error } = await auth.supabase.from('client_documents').insert({
    client_id:     clientId,
    booking_id:    formData.get('booking_id') as string || null,
    name:          formData.get('name') as string || null,
    document_type: formData.get('document_type') as string,
    file_url:      formData.get('file_url') as string || null,
    status:        'uploaded',
    expiry_date:   formData.get('expiry_date') as string || null,
    notes:         formData.get('notes') as string || null,
    uploaded_by:   auth.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function verifyClientDocument(docId: string, status: 'verified' | 'rejected', notes?: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: doc } = await auth.supabase
    .from('client_documents').select('client_id').eq('id', docId).single()

  const { error } = await auth.supabase.from('client_documents').update({
    status,
    verified_by: auth.userId,
    notes:       notes ?? null,
  }).eq('id', docId)

  if (error) return { success: false, error: error.message }
  if (doc?.client_id) revalidatePath(`/clients/${doc.client_id}`)
  return { success: true }
}

// ── Complaints ────────────────────────────────────────────────

export async function createComplaint(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const clientId = formData.get('client_id') as string
  const { data: complaintData, error } = await auth.supabase.from('complaints').insert({
    client_id:   clientId,
    booking_id:  formData.get('booking_id') as string || null,
    category:    formData.get('category') as string,
    priority:    formData.get('priority') as string || 'normal',
    description: formData.get('description') as string,
    status:      'open',
    photo_urls:  [],
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  // Fire complaint_raised automation
  const { data: client } = await auth.supabase.from('clients').select('full_name, phone').eq('id', clientId).single()
  fireAutomations('complaint_raised', {
    complaint: { id: complaintData?.id ?? '', category: formData.get('category') as string },
    client: client ? { id: clientId, full_name: client.full_name, phone: client.phone } : undefined,
  }, 'complaint', complaintData?.id ?? '')

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateComplaintStatus(
  complaintId: string,
  status: string,
  resolutionNotes?: string,
  rating?: number,
) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { data: complaint } = await auth.supabase
    .from('complaints').select('client_id').eq('id', complaintId).single()

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'resolved') {
    update.resolved_at       = new Date().toISOString()
    update.resolution_notes  = resolutionNotes ?? null
    update.satisfaction_rating = rating ?? null
  }

  const { error } = await auth.supabase.from('complaints').update(update).eq('id', complaintId)
  if (error) return { success: false, error: error.message }
  if (complaint?.client_id) revalidatePath(`/clients/${complaint.client_id}`)
  return { success: true }
}

export async function assignComplaint(complaintId: string, advisorId: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: complaint } = await auth.supabase
    .from('complaints').select('client_id').eq('id', complaintId).single()

  const { error } = await auth.supabase.from('complaints').update({
    assigned_to: advisorId,
    status:      'in_progress',
    updated_at:  new Date().toISOString(),
  }).eq('id', complaintId)

  if (error) return { success: false, error: error.message }
  if (complaint?.client_id) revalidatePath(`/clients/${complaint.client_id}`)
  return { success: true }
}
