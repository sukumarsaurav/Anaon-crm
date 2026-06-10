'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from './audit'

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

// ── Login with lockout check ──────────────────────────────────────────────────

export async function secureLogin(email: string, password: string) {
  const svc = serviceSupabase()

  // Find profile by email to check lockout
  const { data: { users } } = await svc.auth.admin.listUsers()
  const authUser = users.find(u => u.email === email)

  if (authUser) {
    const { data: profile } = await svc.from('profiles')
      .select('id, failed_login_count, lockout_until')
      .eq('id', authUser.id)
      .single()

    if (profile?.lockout_until && new Date(profile.lockout_until) > new Date()) {
      const mins = Math.ceil((new Date(profile.lockout_until).getTime() - Date.now()) / 60000)
      return { success: false, error: `Account locked. Try again in ${mins} minute(s).` }
    }
  }

  // Attempt sign-in via browser client (returns session)
  // We return a signal and let the client complete the actual Supabase auth
  // The actual lockout increment is handled via a separate API route on failure
  return { success: true, proceedWithClient: true }
}

export async function recordLoginFailure(email: string) {
  const svc = serviceSupabase()
  const { data: { users } } = await svc.auth.admin.listUsers()
  const authUser = users.find(u => u.email === email)
  if (!authUser) return

  const { data: settings } = await svc.from('security_settings')
    .select('max_failed_attempts, lockout_minutes').limit(1).single()

  const maxAttempts = settings?.max_failed_attempts ?? 5
  const lockoutMinutes = settings?.lockout_minutes ?? 30

  const { data: profile } = await svc.from('profiles')
    .select('failed_login_count').eq('id', authUser.id).single()

  const newCount = (profile?.failed_login_count ?? 0) + 1
  const lockout = newCount >= maxAttempts
    ? new Date(Date.now() + lockoutMinutes * 60000).toISOString()
    : null

  await svc.from('profiles').update({
    failed_login_count: newCount,
    lockout_until: lockout,
  }).eq('id', authUser.id)

  await writeAuditLog({
    userId: authUser.id,
    action: lockout ? 'login_locked' : 'login_failed',
    metadata: { email, attempt: newCount },
  })
}

export async function recordLoginSuccess(userId: string, sessionId: string, deviceInfo: string, ip: string) {
  const svc = serviceSupabase()
  await svc.from('profiles').update({
    failed_login_count: 0,
    lockout_until: null,
    last_login_at: new Date().toISOString(),
    last_login_ip: ip || null,
  }).eq('id', userId)

  await svc.from('user_sessions').insert({
    user_id: userId,
    session_id: sessionId,
    device_info: deviceInfo,
    ip_address: ip || null,
  })

  await writeAuditLog({ userId, action: 'login', metadata: { session_id: sessionId } })
}

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
