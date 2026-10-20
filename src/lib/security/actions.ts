'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { isIP } from 'node:net'
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

async function addIPToWhitelistImpl(formData: FormData) {
  const { user, profile, svc } = await getAuth()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) throw new Error('Unauthorized')

  const ip = (formData.get('ip_address') as string ?? '').trim()
  const label = (formData.get('label') as string ?? '').trim() || null
  // The column is inet; a typo used to fail silently and the form looked saved.
  if (!isIP(ip)) throw new Error(`"${ip}" is not a valid IPv4 or IPv6 address`)

  const { error } = await svc.from('ip_whitelist').insert({ ip_address: ip, label, created_by: user.id })
  if (error) throw new Error(error.code === '23505' ? 'That IP is already on the list' : error.message)
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { ip, label, op: 'add' } })
  revalidatePath('/admin/security')
}

async function toggleIPWhitelistEntryImpl(id: string, isActive: boolean) {
  const { user, profile, svc } = await getAuth()
  if (!['admin'].includes(profile?.role ?? '')) throw new Error('Unauthorized')
  const { error } = await svc.from('ip_whitelist').update({ is_active: isActive }).eq('id', id)
  if (error) throw new Error(error.message)
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { id, is_active: isActive } })
  revalidatePath('/admin/security')
}

/** The caller's IP as the proxy sees it (same headers as proxy.ts). */
async function currentIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
}

async function toggleIPWhitelistGlobalImpl(enabled: boolean) {
  const { user, profile, svc } = await getAuth()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  // Turning the allowlist on from an address that is not on it locked everyone out, this admin
  // included, with no way back in through the CRM.
  if (enabled) {
    const ip = await currentIp()
    const { data: allowed } = ip
      ? await svc.from('ip_whitelist').select('id').eq('ip_address', ip).eq('is_active', true).maybeSingle()
      : { data: null }
    if (!allowed) throw new Error(`Your current IP (${ip ?? 'unknown'}) is not on the active list. Add it first, or you will be locked out.`)
  }

  const { error } = await svc.from('security_settings')
    .update({ ip_whitelist_enabled: enabled, updated_by: user.id, updated_at: new Date().toISOString() })
    .not('id', 'is', null)
  if (error) throw new Error(error.message)
  invalidateSecuritySettings()
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { global_enabled: enabled } })
  revalidatePath('/admin/security')
}

/** Clear a login lockout (failed-password counter) so the person can sign in again now. */
async function unlockAccountImpl(targetUserId: string) {
  const { user, profile, svc } = await getAuth()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) throw new Error('Unauthorized')
  const { error } = await svc.from('profiles')
    .update({ failed_login_count: 0, lockout_until: null, last_failed_login_at: null, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
  if (error) throw new Error(error.message)
  await writeAuditLog({ userId: user.id, action: 'account_unlocked', tableName: 'profiles', recordId: targetUserId })
  revalidatePath('/admin/security')
}

async function updateSecuritySettingsImpl(formData: FormData) {
  const { user, profile, svc } = await getAuth()
  if (profile?.role !== 'admin') throw new Error('Unauthorized')

  const n = (k: string) => Number(formData.get(k))
  const settings = {
    max_failed_attempts: n('max_failed_attempts'),
    lockout_minutes: n('lockout_minutes'),
    session_timeout_minutes: n('session_timeout_minutes'),
  }
  if (!Number.isInteger(settings.max_failed_attempts) || settings.max_failed_attempts < 1) throw new Error('Failed attempts must be at least 1')
  if (!Number.isInteger(settings.lockout_minutes) || settings.lockout_minutes < 1) throw new Error('Lockout must be at least 1 minute')
  // 0 turns the idle timeout off; anything shorter than 5 minutes signs people out mid-task.
  if (!Number.isInteger(settings.session_timeout_minutes) || (settings.session_timeout_minutes !== 0 && settings.session_timeout_minutes < 5)) {
    throw new Error('Session timeout must be 0 (off) or at least 5 minutes')
  }

  const { error } = await svc.from('security_settings').update({
    ...settings,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).not('id', 'is', null)
  if (error) throw new Error(error.message)
  invalidateSecuritySettings()
  await writeAuditLog({ userId: user.id, action: 'ip_whitelist_updated', metadata: { security_settings: settings } })
  revalidatePath('/admin/security')
}

// ── Exported actions ───────────────────────────────────────────────────────────
// They return the error instead of throwing: Next.js replaces a thrown message with a generic one in
// production, so "your IP is not on the list" never reached the admin.
type Result = { success: boolean; error?: string }
async function asResult(run: () => Promise<void>): Promise<Result> {
  try { await run(); return { success: true } } catch (e) { return { success: false, error: (e as Error).message } }
}
export async function addIPToWhitelist(formData: FormData): Promise<Result> { return asResult(() => addIPToWhitelistImpl(formData)) }
export async function toggleIPWhitelistEntry(id: string, isActive: boolean): Promise<Result> { return asResult(() => toggleIPWhitelistEntryImpl(id, isActive)) }
export async function toggleIPWhitelistGlobal(enabled: boolean): Promise<Result> { return asResult(() => toggleIPWhitelistGlobalImpl(enabled)) }
export async function unlockAccount(targetUserId: string): Promise<Result> { return asResult(() => unlockAccountImpl(targetUserId)) }
export async function updateSecuritySettings(formData: FormData): Promise<Result> { return asResult(() => updateSecuritySettingsImpl(formData)) }
