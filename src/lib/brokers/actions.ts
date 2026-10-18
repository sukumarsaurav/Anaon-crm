'use server'

import { revalidatePath } from 'next/cache'
import { ingestLead, normalizePhone } from '@/lib/leads/ingest'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, error: 'Unauthorized', supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

const isManager = (role: string) => ['admin', 'manager'].includes(role)

// ── Admin: broker management ───────────────────────────────────────

export async function createBroker(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data, error } = await auth.supabase.from('brokers').insert({
    full_name:       formData.get('full_name') as string,
    firm_name:       formData.get('firm_name') as string || null,
    email:           formData.get('email') as string || null,
    phone:           formData.get('phone') as string || null,
    city:            formData.get('city') as string || null,
    address:         formData.get('address') as string || null,
    rera_number:     formData.get('rera_number') as string || null,
    commission_rate: parseFloat(formData.get('commission_rate') as string) || 2,
    bank_name:       formData.get('bank_name') as string || null,
    account_number:  formData.get('account_number') as string || null,
    ifsc:            formData.get('ifsc') as string || null,
    gstin:           formData.get('gstin') as string || null,
    notes:           formData.get('notes') as string || null,
    status:          'pending',
    invited_by:      auth.userId,
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }).select('id').single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed' }
  revalidatePath('/brokers')
  return { success: true, id: data.id }
}

export async function updateBroker(id: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('brokers').update({
    full_name:       formData.get('full_name') as string,
    firm_name:       formData.get('firm_name') as string || null,
    email:           formData.get('email') as string || null,
    phone:           formData.get('phone') as string || null,
    city:            formData.get('city') as string || null,
    address:         formData.get('address') as string || null,
    rera_number:     formData.get('rera_number') as string || null,
    commission_rate: parseFloat(formData.get('commission_rate') as string) || 2,
    bank_name:       formData.get('bank_name') as string || null,
    account_number:  formData.get('account_number') as string || null,
    ifsc:            formData.get('ifsc') as string || null,
    gstin:           formData.get('gstin') as string || null,
    notes:           formData.get('notes') as string || null,
    updated_at:      new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/brokers/${id}`)
  revalidatePath('/brokers')
  return { success: true }
}

export async function approveBroker(id: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('brokers').update({
    status:        'approved',
    approved_by:   auth.userId,
    onboarded_at:  new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/brokers/${id}`)
  revalidatePath('/brokers')
  return { success: true }
}

export async function rejectBroker(id: string, reason: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('brokers').update({
    status:          'rejected',
    rejected_reason: reason,
    updated_at:      new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/brokers/${id}`)
  revalidatePath('/brokers')
  return { success: true }
}

export async function deactivateBroker(id: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('brokers').update({
    status:     'inactive',
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/brokers/${id}`)
  revalidatePath('/brokers')
  return { success: true }
}

// ── Admin: link broker to auth user ───────────────────────────────

export async function linkBrokerAuthUser(brokerId: string, email: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  // Check if user already exists
  const { data: existing } = await auth.supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    // Update broker to link auth user
    const { data: userRow } = await auth.supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (userRow) {
      // Linking via brokers.auth_user_id is what grants portal access. (This also set
      // profiles.role = 'broker', which isn't a user_role value — the update always
      // failed — and if it had worked it would have demoted a staff account.)
      await auth.supabase.from('brokers').update({ auth_user_id: userRow.id, updated_at: new Date().toISOString() }).eq('id', brokerId)
    }
  }

  revalidatePath(`/brokers/${brokerId}`)
  return { success: true }
}

// ── Admin: commission batch management ─────────────────────────────

export async function approveCommissionBatch(commissionIds: string[]) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase
    .from('broker_commissions')
    .update({ status: 'approved', approved_by: auth.userId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('id', commissionIds)
    .eq('status', 'pending')

  if (error) return { success: false, error: error.message }
  revalidatePath('/brokers/commissions')
  return { success: true }
}

export async function markCommissionPaidBatch(commissionIds: string[], utrNumber: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase
    .from('broker_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString(), utr_number: utrNumber, updated_at: new Date().toISOString() })
    .in('id', commissionIds)
    .eq('status', 'approved')

  if (error) return { success: false, error: error.message }
  revalidatePath('/brokers/commissions')
  return { success: true }
}

// ── Broker portal: lead registration ──────────────────────────────

export async function registerBrokerLead(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: broker } = await supabase
    .from('brokers')
    .select('id, status, full_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!broker) return { success: false, error: 'Broker profile not found' }
  if (broker.status !== 'approved') return { success: false, error: 'Broker account is not approved' }

  const phone     = (formData.get('client_phone') as string).trim()
  const projectId = formData.get('project_id') as string || null
  const notes     = (formData.get('notes') as string)?.trim() || null
  const budgetMin = parseFloat(formData.get('budget_min') as string) || null
  const budgetMax = parseFloat(formData.get('budget_max') as string) || null
  if (!normalizePhone(phone)) return { success: false, error: 'Enter a valid 10-digit Indian mobile number' }

  // The shared ingest (service client) dedupes against ALL leads — a broker can't see
  // them under RLS, so the old check here always said "new" — and applies assignment
  // rules, scoring and automations like every other source.
  const ingested = await ingestLead({
    source: 'broker',
    full_name: formData.get('client_name') as string,
    phone,
    project_id: projectId,
    broker_id: broker.id,
    budget_min: budgetMin,
    budget_max: budgetMax,
    requirement: [`Registered by channel partner ${broker.full_name}`, notes].filter(Boolean).join(' — '),
    utm_source: 'broker',
  })
  if (!ingested.ok) return { success: false, error: ingested.error ?? 'Failed to register lead' }
  const isDuplicate = Boolean(ingested.duplicate)

  const { data: reg, error } = await supabase.from('broker_lead_registrations').insert({
    broker_id:           broker.id,
    client_name:         formData.get('client_name') as string,
    client_phone:        phone,
    project_id:          projectId,
    budget_min:          budgetMin,
    budget_max:          budgetMax,
    notes,
    status:              isDuplicate ? 'duplicate' : 'registered',
    duplicate_of_lead_id: isDuplicate ? ingested.id : null,
    crm_lead_id:         isDuplicate ? null : ingested.id,
  }).select('id').single()

  if (error || !reg) return { success: false, error: error?.message ?? 'Failed to register lead' }

  revalidatePath('/broker-portal/leads')
  return { success: true, isDuplicate, id: reg.id }
}

// ── Admin: update lead registration status ─────────────────────────

export async function updateLeadRegistrationStatus(
  regId: string,
  status: 'registered' | 'converted' | 'lost',
  crmLeadId?: string,
) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (crmLeadId) update.crm_lead_id = crmLeadId

  const { error } = await auth.supabase.from('broker_lead_registrations').update(update).eq('id', regId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/brokers')
  return { success: true }
}
