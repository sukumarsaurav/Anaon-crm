import { createClient as createServiceClient } from '@supabase/supabase-js'
import { writeAuditLog } from './audit'

/**
 * Login lockout primitives.
 *
 * Deliberately NOT a `'use server'` module: these are called from the
 * `/api/auth/login` route handler only. Exporting them as server actions would
 * publish an unauthenticated endpoint that reveals whether an email exists.
 */

/** ILIKE treats _ and % as wildcards, so "a_b@x.com" also matched "axb@x.com" (failures and lockouts
 *  were attributed to the wrong account). Escape them to match the email literally. */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

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
 * Reads `profiles`, which mirrors the email and is indexed — one cheap query.
 * Falls back to paging the admin user list only when that misses, since
 * `profiles.email` can be null on rows created before the column was populated.
 *
 * The fallback pages deliberately: `listUsers()` defaults to 50 per page, so a
 * single call plus `.find()` silently stops matching anyone past the first page.
 * It is also slow enough to dominate login latency (~2s), which is why it is no
 * longer the primary path.
 */
async function findAuthUserIdByEmail(
  svc: ReturnType<typeof serviceSupabase>,
  email: string,
): Promise<string | null> {
  const needle = email.trim().toLowerCase()

  const { data: profile } = await svc
    .from('profiles')
    .select('id')
    .ilike('email', likeLiteral(needle))
    .maybeSingle()

  if (profile?.id) return profile.id

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

  // Resolve the user and read their lockout in one query — this runs before
  // every sign-in, so a second round-trip here is paid on every login.
  const { data: profile } = await svc
    .from('profiles')
    .select('id, lockout_until')
    .ilike('email', likeLiteral(email.trim().toLowerCase()))
    .maybeSingle()

  let userId = profile?.id ?? null
  let lockoutUntil = profile?.lockout_until ?? null

  if (!userId) {
    // Profile row missing or email not mirrored — fall back to the admin API.
    userId = await findAuthUserIdByEmail(svc, email)
    if (!userId) return { locked: false, userId: null }

    const { data: fallback } = await svc
      .from('profiles')
      .select('lockout_until')
      .eq('id', userId)
      .maybeSingle()
    lockoutUntil = fallback?.lockout_until ?? null
  }

  const until = lockoutUntil ? new Date(lockoutUntil) : null
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

/**
 * Records a successful sign-in and returns the user's role.
 *
 * The three writes are independent, so they go out together rather than in
 * sequence — on the login path each round-trip is latency the user watches. The
 * role comes back from the profile update itself, which saves the caller a
 * further query just to decide where to redirect.
 */
export async function recordLoginSuccess(
  userId: string,
  sessionId: string,
  deviceInfo: string,
  ip: string,
): Promise<{ role: string | null; isActive: boolean }> {
  const svc = serviceSupabase()

  const [profileRes] = await Promise.all([
    svc.from('profiles').update({
      failed_login_count: 0,
      lockout_until: null,
      last_failed_login_at: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: ip || null,
    }).eq('id', userId).select('role, is_active').maybeSingle(),

    svc.from('user_sessions').insert({
      user_id: userId,
      session_id: sessionId,
      device_info: deviceInfo,
      ip_address: ip || null,
    }),

    writeAuditLog({ userId, action: 'login', metadata: { session_id: sessionId } }),
  ])

  return { role: profileRes.data?.role ?? null, isActive: profileRes.data?.is_active !== false }
}
