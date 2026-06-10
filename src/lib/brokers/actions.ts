'use server'

import { revalidatePath } from 'next/cache'
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
      await auth.supabase.from('brokers').update({ auth_user_id: userRow.id, updated_at: new Date().toISOString() }).eq('id', brokerId)
      await auth.supabase.from('profiles').update({ role: 'broker' }).eq('id', userRow.id)
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

  // Duplicate detection: check if this phone already exists in leads
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  const isDuplicate = !!existingLead

  // Insert registration
  const { data: reg, error } = await supabase.from('broker_lead_registrations').insert({
    broker_id:           broker.id,
    client_name:         formData.get('client_name') as string,
    client_phone:        phone,
    project_id:          projectId,
    budget_min:          parseFloat(formData.get('budget_min') as string) || null,
    budget_max:          parseFloat(formData.get('budget_max') as string) || null,
    notes:               formData.get('notes') as string || null,
    status:              isDuplicate ? 'duplicate' : 'registered',
    duplicate_of_lead_id: isDuplicate ? existingLead!.id : null,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  }).select('id').single()

  if (error || !reg) return { success: false, error: error?.message ?? 'Failed to register lead' }

  // If not a duplicate, auto-create CRM lead
  if (!isDuplicate) {
    const { data: lead } = await supabase.from('leads').insert({
      full_name:      formData.get('client_name') as string,
      phone:          phone,
      source:         'broker',
      referred_by:    broker.full_name,
      project_id:     projectId,
      budget_min:     parseFloat(formData.get('budget_min') as string) || null,
      budget_max:     parseFloat(formData.get('budget_max') as string) || null,
      notes:          formData.get('notes') as string || null,
      stage:          'new_lead',
      score:          0,
      temperature:    'cold',
      created_at:     new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    }).select('id').single()

    if (lead) {
      await supabase.from('broker_lead_registrations')
        .update({ crm_lead_id: lead.id })
        .eq('id', reg.id)
    }
  }

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
