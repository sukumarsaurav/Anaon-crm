'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { deliverOtp } from '@/lib/messaging/otp'
import { createServiceClient } from '@/lib/supabase/service'
import { getPortalSession } from './session'
import { notifyUsers, type NotifyInput } from '@/lib/notifications/notify'
import { fireAutomations } from '@/lib/automation/engine'
import { createHash, randomInt } from 'crypto'

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

/** Tell the people who handle customer requests (admins and managers). Never throws. */
async function notifyManagers(input: NotifyInput) {
  const { data } = await portalDb().from('profiles').select('id').in('role', ['admin', 'manager']).eq('is_active', true)
  await notifyUsers((data ?? []).map((p) => p.id), input)
}

// crypto, not Math.random: an OTP is a credential.
function generateOtp(): string {
  return String(randomInt(100000, 1000000))
}

// The portal_* functions are SECURITY DEFINER and trust their arguments (the OTP hash,
// the client id), so EXECUTE is revoked from anon/authenticated and only this server
// code, as service_role, may call them. Calling them with the browser-visible key let
// anyone store an OTP hash of their choosing for any client's phone and log in as them.
function portalDb() {
  return createServiceClient()
}

// ── OTP auth ────────────────────────────────────────────────────────

export async function sendPortalOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  // Digits only, last 10: "+91-98100 01025" and "9810001025" are the same person.
  const cleaned = phone.replace(/\D/g, '').slice(-10)
  const otp     = generateOtp()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const supabase = portalDb()
  const { data: result } = await supabase.rpc('portal_create_otp', {
    p_phone:      cleaned,
    p_otp_hash:   hashOtp(otp),
    p_expires_at: expires,
  })

  if (result === 'no_client')    return { success: false, error: 'No account found with this phone number. Please contact ANON INDIA.' }
  if (result === 'rate_limited') return { success: false, error: 'Too many OTP requests. Please wait 10 minutes.' }

  // Deliver via WhatsApp (primary) → SMS (fallback). The OTP is NEVER returned
  // to the client — delivery happens out-of-band only.
  const delivery = await deliverOtp(cleaned, otp)
  if (!delivery.success) {
    // In dev, surface the code in server logs so local testing still works.
    if (process.env.NODE_ENV === 'development') {
      console.log(`[portal-otp] delivery unavailable — OTP for ${cleaned}: ${otp}`)
      return { success: true }
    }
    return { success: false, error: 'Could not send OTP right now. Please try again shortly.' }
  }

  return { success: true }
}

export async function verifyPortalOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  // Digits only, last 10: "+91-98100 01025" and "9810001025" are the same person.
  const cleaned = phone.replace(/\D/g, '').slice(-10)

  const supabase = portalDb()
  const { data: result } = await supabase.rpc('portal_verify_otp', {
    p_phone:    cleaned,
    p_otp_hash: hashOtp(otp),
  })

  if (result === 'otp_not_found')    return { success: false, error: 'OTP not found. Please request a new one.' }
  if (result === 'otp_expired')      return { success: false, error: 'OTP has expired. Please request a new one.' }
  if (result === 'too_many_attempts') return { success: false, error: 'Too many attempts. Please request a new OTP.' }
  if (result === 'invalid_otp')      return { success: false, error: 'Incorrect OTP. Please try again.' }
  if (result === 'client_not_found') return { success: false, error: 'Client not found.' }

  // result is the session token
  const cookieStore = await cookies()
  cookieStore.set('client_portal_session', result as string, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   30 * 24 * 60 * 60,
    path:     '/',
  })

  return { success: true }
}

export async function logoutPortal(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('client_portal_session')?.value
  if (token) {
    await portalDb().rpc('portal_delete_session', { p_token: token })
    cookieStore.delete('client_portal_session')
  }
}

// ── Payment extension request (client) ────────────────────────────

// `_clientId` is kept for existing callers but ignored: a server action is a public
// endpoint, so the client is always the one signed in to the portal, never the argument.
export async function requestPaymentExtension(_clientId: string, formData: FormData) {
  const session = await getPortalSession()
  if (!session) return { success: false, error: 'Please sign in again' }
  const paymentId = formData.get('payment_id') as string
  const { data: payment } = await portalDb().from('payments').select('id').eq('id', paymentId).eq('client_id', session.client.id).maybeSingle()
  if (!payment) return { success: false, error: 'Payment not found' }
  const { error } = await portalDb().rpc('portal_create_extension_request', {
    p_client_id:      session.client.id,
    p_payment_id:     formData.get('payment_id') as string,
    p_booking_id:     formData.get('booking_id') as string,
    p_reason:         formData.get('reason') as string,
    p_requested_date: formData.get('requested_date') as string,
  })

  if (error) return { success: false, error: error.message }
  await notifyManagers({
    title: 'Payment extension requested',
    message: `${session.client.full_name} asked to move an installment to ${formData.get('requested_date')}.`,
    type: 'extension_request', related_type: 'client', related_id: session.client.id,
    action_url: '/clients/extension-requests',
  })
  return { success: true }
}

// ── Complaint from portal (client) ────────────────────────────────

export async function raisePortalComplaint(_clientId: string, formData: FormData) {
  const session = await getPortalSession()
  if (!session) return { success: false, error: 'Please sign in again' }
  const bookingId = (formData.get('booking_id') as string) || null
  if (bookingId) {
    const { data: booking } = await portalDb().from('bookings').select('id').eq('id', bookingId).eq('client_id', session.client.id).maybeSingle()
    if (!booking) return { success: false, error: 'Booking not found' }
  }
  const { error } = await portalDb().rpc('portal_create_complaint', {
    p_client_id:  session.client.id,
    p_booking_id: bookingId,
    p_category:   formData.get('category') as string,
    p_description: `${formData.get('title') as string}: ${formData.get('description') as string}`,
  })

  if (error) return { success: false, error: error.message }
  // Complaints raised in the CRM already notify staff and fire the automation; ones raised by
  // the customer in the portal told nobody.
  await notifyManagers({
    title: 'New customer complaint',
    message: `${session.client.full_name} raised a complaint (${formData.get('category')}).`,
    type: 'complaint', related_type: 'client', related_id: session.client.id,
    action_url: `/clients/${session.client.id}?tab=complaints`,
  })
  fireAutomations('complaint_raised', {
    client: { id: session.client.id, full_name: session.client.full_name, phone: session.client.phone },
  }, 'client', session.client.id)
  return { success: true }
}

// ── Construction updates (admin) ───────────────────────────────────

export async function createConstructionUpdate(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const profile = (await getProfile())?.profile
  if (!['admin', 'manager', 'sales_advisor'].includes(profile?.role ?? '')) return { success: false, error: 'Forbidden' }

  const projectId = formData.get('project_id') as string

  const { error } = await supabase.from('construction_updates').insert({
    project_id:          projectId,
    title:               formData.get('title') as string,
    description:         formData.get('description') as string || null,
    milestone:           formData.get('milestone') as string || null,
    percentage_complete: parseFloat(formData.get('percentage_complete') as string) || 0,
    update_date:         formData.get('update_date') as string || new Date().toISOString().split('T')[0],
    is_published:        formData.get('is_published') === 'true',
    posted_by:           user.id,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  return { success: true }
}

export async function toggleConstructionUpdatePublished(updateId: string, published: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('construction_updates')
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq('id', updateId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  return { success: true }
}

export async function deleteConstructionUpdate(updateId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('construction_updates').delete().eq('id', updateId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  return { success: true }
}

// ── Payment extension review (admin) ──────────────────────────────

export async function reviewExtensionRequest(requestId: string, status: 'approved' | 'rejected', notes?: string) {
  const supabase = await createClient()
  const session = await getProfile()
  const user = session?.user
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!['admin', 'manager'].includes(session?.profile?.role ?? '')) return { success: false, error: 'Forbidden' }

  const { data: req } = await supabase
    .from('payment_extension_requests')
    .select('id, status, payment_id, requested_date')
    .eq('id', requestId)
    .single()
  if (!req) return { success: false, error: 'Request not found' }
  if (req.status !== 'pending') return { success: false, error: 'This request was already reviewed' }

  // Approving has to actually move the due date, otherwise the customer is told yes and the
  // schedule (and overdue reminders) still use the old date.
  if (status === 'approved') {
    const { error: payErr } = await supabase
      .from('payments')
      .update({ due_date: req.requested_date, updated_at: new Date().toISOString() })
      .eq('id', req.payment_id)
    if (payErr) return { success: false, error: `Could not move the due date: ${payErr.message}` }
  }

  const { error } = await supabase.from('payment_extension_requests').update({
    status,
    admin_notes:  notes ?? null,
    reviewed_by:  user.id,
    reviewed_at:  new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('id', requestId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/clients')
  revalidatePath('/clients/extension-requests')
  return { success: true }
}
