'use server'

import { revalidatePath } from 'next/cache'
import { ingestLead, normalizePhone } from '@/lib/leads/ingest'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireAutomations } from '@/lib/automation/engine'
import { notifyUsers } from '@/lib/notifications/notify'
import { getProfile } from '@/lib/supabase/getProfile'

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, error: 'Unauthorized', supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

const isManager = (role: string) => ['admin', 'manager'].includes(role)

/** A deactivated broker must not keep a working login. No-op when they never had one. */
async function setBrokerLoginEnabled(brokerId: string, enabled: boolean) {
  const svc = createServiceClient()
  const { data } = await svc.from('brokers').select('auth_user_id').eq('id', brokerId).maybeSingle()
  if (!data?.auth_user_id) return
  await svc.auth.admin.updateUserById(data.auth_user_id, { ban_duration: enabled ? 'none' : '876000h' })
  await svc.from('profiles').update({ is_active: enabled }).eq('id', data.auth_user_id)
}

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
  await setBrokerLoginEnabled(id, true)
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
  await setBrokerLoginEnabled(id, false)
  revalidatePath(`/brokers/${id}`)
  revalidatePath('/brokers')
  return { success: true }
}

// ── Admin: broker portal access ───────────────────────────────────

/**
 * Creates the broker's portal login. Until now nothing could: `linkBrokerAuthUser` only linked
 * an *existing* profile by email (so it could attach a staff account to a broker), the broker
 * portal gate checks `role === 'broker'` — a value that did not exist — and the login route
 * turned every non-staff role away. The account is created with `app_metadata.role = 'broker'`
 * (service-role-only), which `handle_new_user()` turns into a broker profile.
 *
 * Returns a temporary password ONCE; it is not stored anywhere readable.
 */
export async function grantBrokerPortalAccess(brokerId: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false as const, error: 'Forbidden' }

  const svc = createServiceClient()
  const { data: broker } = await svc.from('brokers')
    .select('id, full_name, email, phone, status, auth_user_id').eq('id', brokerId).single()

  if (!broker) return { success: false as const, error: 'Broker not found' }
  if (broker.status !== 'approved') return { success: false as const, error: 'Approve the broker first' }
  if (broker.auth_user_id) return { success: false as const, error: 'This broker already has portal access' }
  if (!broker.email) return { success: false as const, error: 'Add an email address to the broker first' }

  const tempPassword = `Br-${randomBytes(9).toString('base64url')}7!`
  const { data: created, error } = await svc.auth.admin.createUser({
    email: broker.email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: 'broker' },
    user_metadata: { full_name: broker.full_name },
  })
  if (error || !created.user) {
    // An existing account is never taken over: it could be a staff login.
    const exists = /already|registered|exists/i.test(error?.message ?? '')
    return { success: false as const, error: exists ? 'That email already has an account — use a different email for the broker.' : (error?.message ?? 'Could not create the login') }
  }

  // The trigger sets role from app_metadata; make it certain, and keep contact details.
  await svc.from('profiles').update({ role: 'broker', phone: broker.phone, full_name: broker.full_name, is_active: true }).eq('id', created.user.id)
  const { error: linkErr } = await svc.from('brokers')
    .update({ auth_user_id: created.user.id, onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', brokerId)
  if (linkErr) {
    await svc.auth.admin.deleteUser(created.user.id)
    return { success: false as const, error: linkErr.message }
  }

  revalidatePath(`/brokers/${brokerId}`)
  return { success: true as const, email: broker.email, tempPassword }
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

  // broker_commission_approved automation + a notification for brokers with portal access.
  // (Before, only an unused single-row action fired it, so the trigger never ran.)
  const { data: approved } = await auth.supabase
    .from('broker_commissions')
    .select('id, broker_id, commission_amount, brokers(full_name, phone, auth_user_id)')
    .in('id', commissionIds)
    .eq('status', 'approved')
  for (const c of approved ?? []) {
    const broker = (Array.isArray(c.brokers) ? c.brokers[0] : c.brokers) as
      { full_name: string; phone: string | null; auth_user_id: string | null } | null
    fireAutomations('broker_commission_approved', {
      lead: broker ? { id: c.broker_id, full_name: broker.full_name, phone: broker.phone ?? '' } : undefined,
    }, 'broker_commission', c.id)
    if (broker?.auth_user_id) {
      await notifyUsers([broker.auth_user_id], {
        title: 'Commission approved',
        message: `Your commission of ₹${Number(c.commission_amount ?? 0).toLocaleString('en-IN')} has been approved.`,
        type: 'commission',
        related_type: 'broker_commission',
        related_id: c.id,
        action_url: '/broker-portal/commissions',
      })
    }
  }

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
