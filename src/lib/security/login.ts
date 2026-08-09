import { createClient as createServiceClient } from '@supabase/supabase-js'
import { writeAuditLog } from './audit'

/**
 * Login lockout primitives.
 *
 * Deliberately NOT a `'use server'` module: these are called from the
 * `/api/auth/login` route handler only. Exporting them as server actions would
 * publish an unauthenticated endpoint that reveals whether an email exists.
 */

function serviceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type LockoutPolicy = { maxAttempts: number; lockoutMinutes: number }

async function getLockoutPolicy(
  svc: ReturnType<typeof serviceSupabase>,
): Promise<LockoutPolicy> {
  const { data } = await svc
    .from('security_settings')
    .select('max_failed_attempts, lockout_minutes')
    .limit(1)
    .maybeSingle()

  return {
    maxAttempts: data?.max_failed_attempts ?? 5,
    lockoutMinutes: data?.lockout_minutes ?? 30,
  }
}

/**
 * Resolve an auth user id from an email.
 *
 * `listUsers()` defaults to 50 users per page, so the previous single-call
 * `.find()` silently stopped matching anyone past the first page. This walks
 * every page instead.
 */
async function findAuthUserIdByEmail(
  svc: ReturnType<typeof serviceSupabase>,
  email: string,
): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  const perPage = 1000

  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage })
    if (error) return null

    const match = data.users.find((u) => u.email?.toLowerCase() === needle)
    if (match) return match.id

    if (data.users.length < perPage) return null
  }
}

/**
 * Failures older than the lockout window don't count towards the lockout.
 *
 * Without this the counter accumulated forever — a typo in July plus two more
 * in August was enough to lock an account, and once locked the count stayed at
 * the maximum so every subsequent typo re-locked it immediately.
 */
function countsTowardsLockout(
  lastFailedAt: string | null,
  windowMinutes: number,
): boolean {
  if (!lastFailedAt) return false
  return Date.now() - new Date(lastFailedAt).getTime() < windowMinutes * 60_000
}

export type LockoutStatus =
  | { locked: false; userId: string | null }
  | { locked: true; userId: string; minutes: number }

export async function checkAccountLockout(email: string): Promise<LockoutStatus> {
  const svc = serviceSupabase()

  const userId = await findAuthUserIdByEmail(svc, email)
  if (!userId) return { locked: false, userId: null }

  const { data: profile } = await svc
    .from('profiles')
    .select('lockout_until')
    .eq('id', userId)
    .maybeSingle()

  const until = profile?.lockout_until ? new Date(profile.lockout_until) : null
  if (until && until > new Date()) {
    return {
      locked: true,
      userId,
      minutes: Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000)),
    }
  }

  return { locked: false, userId }
}

export async function recordLoginFailure(email: string, userId?: string | null) {
  const svc = serviceSupabase()

  const id = userId ?? (await findAuthUserIdByEmail(svc, email))
  if (!id) return

  const { maxAttempts, lockoutMinutes } = await getLockoutPolicy(svc)

  const { data: profile } = await svc
    .from('profiles')
    .select('failed_login_count, last_failed_login_at')
    .eq('id', id)
    .maybeSingle()

  // Stale failures are dropped, so the count restarts at 1 after a quiet window.
  // The window and the lockout share `lockout_minutes`, so a lockout expiring
  // also clears the count that caused it rather than leaving it at the maximum.
  const priorCount = countsTowardsLockout(profile?.last_failed_login_at ?? null, lockoutMinutes)
    ? (profile?.failed_login_count ?? 0)
    : 0

  const newCount = priorCount + 1
  const lockout = newCount >= maxAttempts
    ? new Date(Date.now() + lockoutMinutes * 60_000).toISOString()
    : null

  await svc.from('profiles').update({
    failed_login_count: newCount,
    last_failed_login_at: new Date().toISOString(),
    lockout_until: lockout,
  }).eq('id', id)

  await writeAuditLog({
    userId: id,
    action: lockout ? 'login_locked' : 'login_failed',
    metadata: { email, attempt: newCount },
  })
}

export async function recordLoginSuccess(
  userId: string,
  sessionId: string,
  deviceInfo: string,
  ip: string,
) {
  const svc = serviceSupabase()

  await svc.from('profiles').update({
    failed_login_count: 0,
    lockout_until: null,
    last_failed_login_at: null,
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
