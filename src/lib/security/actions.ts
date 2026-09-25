'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from './audit'
import { invalidateSecuritySettings } from './proxyCache'

function serviceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) throw new Error('Unauthorized')
  const profile = (await getProfile())?.profile
  return { supabase, user, profile, svc: serviceSupabase() }
}

// Login lockout lives in `./login.ts` — it must not be a server action, since
// that would expose an unauthenticated email-existence oracle.

// ── Session management ────────────────────────────────────────────────────────

export async function getActiveSessions(targetUserId?: string) {
  const { user, profile } = await getAuth()
  const uid = targetUserId && ['admin', 'manager'].includes(profile?.role ?? '') ? targetUserId : user.id
  const supabase = await createClient()
  return supabase.from('user_sessions')
    .select('*')
    .eq('user_id', uid)
    .eq('is_active', true)
    .order('last_active_at', { ascending: false })
}

export async function revokeSession(sessionId: string, targetUserId?: string) {
  const { user, profile, svc } = await getAuth()
  if (targetUserId && !['admin', 'manager'].includes(profile?.role ?? '')) {
    throw new Error('Unauthorized')
  }
  const uid = targetUserId ?? user.id

  await svc.from('user_sessions').update({
    is_active: false,
    revoked_at: new Date().toISOString(),
    revoked_by: user.id,
  }).eq('id', sessionId).eq('user_id', uid)

  // Sign out the Supabase session (admin API)
  const { data: session } = await svc.from('user_sessions').select('session_id').eq('id', sessionId).single()
  if (session?.session_id) {
    await svc.auth.admin.signOut(session.session_id)
  }

  await writeAuditLog({ userId: user.id, action: 'session_revoked', metadata: { target_user: uid } })
  revalidatePath('/admin/security')
}

// ── IP Whitelist ──────────────────────────────────────────────────────────────

export async function addIPToWhitelist(formData: FormData) {
  const { user, profile, svc } = await getAuth()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) throw new Error('Unauthorized')

  const ip = formData.get('ip_address') as string
  const label = formData.get('label') as string

  await svc.from('ip_whitelist').insert({ ip_address: ip, label, created_by: user.id })
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { ip, label, op: 'add' } })
  revalidatePath('/admin/security')
}

export async function toggleIPWhitelistEntry(id: string, isActive: boolean) {
  const { user, profile, svc } = await getAuth()
  if (!['admin'].includes(profile?.role ?? '')) throw new Error('Unauthorized')
  await svc.from('ip_whitelist').update({ is_active: isActive }).eq('id', id)
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { id, is_active: isActive } })
  revalidatePath('/admin/security')
}

export async function toggleIPWhitelistGlobal(enabled: boolean) {
  const { user, profile, svc } = await getAuth()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')
  await svc.from('security_settings').update({ ip_whitelist_enabled: enabled, updated_by: user.id, updated_at: new Date().toISOString() })
  invalidateSecuritySettings()
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { global_enabled: enabled } })
  revalidatePath('/admin/security')
}

export async function updateSecuritySettings(formData: FormData) {
  const { user, profile, svc } = await getAuth()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  await svc.from('security_settings').update({
    max_failed_attempts: Number(formData.get('max_failed_attempts')),
    lockout_minutes: Number(formData.get('lockout_minutes')),
    session_timeout_minutes: Number(formData.get('session_timeout_minutes')),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  })
  revalidatePath('/admin/security')
}
