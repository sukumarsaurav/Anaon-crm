'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ── OTP auth ────────────────────────────────────────────────────────

export async function sendPortalOtp(phone: string): Promise<{ success: boolean; error?: string; otp?: string }> {
  const cleaned = phone.replace(/\s+/g, '').replace(/^(\+91|91)/, '')
  const otp     = generateOtp()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const supabase = await createClient()
  const { data: result } = await supabase.rpc('portal_create_otp', {
    p_phone:      cleaned,
    p_otp_hash:   hashOtp(otp),
    p_expires_at: expires,
  })

  if (result === 'no_client')    return { success: false, error: 'No account found with this phone number. Please contact ANON INDIA.' }
  if (result === 'rate_limited') return { success: false, error: 'Too many OTP requests. Please wait 10 minutes.' }

  // In production: send OTP via WhatsApp / SMS here
  const isDev = process.env.NODE_ENV === 'development'
  return { success: true, otp: isDev ? otp : undefined }
}

export async function verifyPortalOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const cleaned = phone.replace(/\s+/g, '').replace(/^(\+91|91)/, '')

  const supabase = await createClient()
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
    const supabase = await createClient()
    await supabase.rpc('portal_delete_session', { p_token: token })
    cookieStore.delete('client_portal_session')
  }
}

// ── Payment extension request (client) ────────────────────────────

export async function requestPaymentExtension(clientId: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('portal_create_extension_request', {
    p_client_id:      clientId,
    p_payment_id:     formData.get('payment_id') as string,
    p_booking_id:     formData.get('booking_id') as string,
    p_reason:         formData.get('reason') as string,
    p_requested_date: formData.get('requested_date') as string,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Complaint from portal (client) ────────────────────────────────

export async function raisePortalComplaint(clientId: string, formData: FormData) {
  const supabase = await createClient()
  const bookingId = (formData.get('booking_id') as string) || null
  const { error } = await supabase.rpc('portal_create_complaint', {
    p_client_id:  clientId,
    p_booking_id: bookingId,
    p_category:   formData.get('category') as string,
    p_description: `${formData.get('title') as string}: ${formData.get('description') as string}`,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Construction updates (admin) ───────────────────────────────────

export async function createConstructionUpdate(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('payment_extension_requests').update({
    status,
    admin_notes:  notes ?? null,
    reviewed_by:  user.id,
    reviewed_at:  new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('id', requestId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/clients')
  return { success: true }
}
