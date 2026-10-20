import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkAccountLockout,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/security/login'

/**
 * Password sign-in.
 *
 * The lockout check, the sign-in itself, and the failure/success bookkeeping all
 * happen here. They used to be three separate calls made by the browser around a
 * client-side `signInWithPassword`, which meant anything talking to Supabase
 * directly skipped the lockout entirely and never incremented the counter.
 *
 * `/api/auth` is allowlisted in `src/proxy.ts`, so this route is reachable
 * unauthenticated by design.
 */

const STAFF_ROLES = ['admin', 'manager', 'sales_advisor', 'telecaller']

// Deliberately uniform: never reveal whether the email exists.
const INVALID_CREDENTIALS = 'Invalid email or password.'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? '127.0.0.1'

    const lockout = await checkAccountLockout(email)
    if (lockout.locked) {
      return NextResponse.json(
        { error: `Account locked. Try again in ${lockout.minutes} minute(s).` },
        { status: 423 },
      )
    }

    // Server-side sign-in: `cookies()` is writable in a route handler, so the
    // session cookies land on this response and the browser client picks them up.
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session || !data.user) {
      await recordLoginFailure(email, lockout.userId)

      // Re-read so the user is told immediately when this attempt locked them out.
      const after = await checkAccountLockout(email)
      if (after.locked) {
        return NextResponse.json(
          { error: `Account locked. Try again in ${after.minutes} minute(s).` },
          { status: 423 },
        )
      }
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 })
    }

    // The role comes back from the same write that records the login, through
    // the service client — so profile RLS can never turn a valid sign-in into a
    // failed redirect, and it costs no extra round-trip.
    const { role, isActive } = await recordLoginSuccess(
      data.user.id,
      data.session.access_token.slice(-20),
      req.headers.get('user-agent')?.slice(0, 200) ?? '',
      ip,
    )

    // Deactivating an employee or broker used to flip profiles.is_active and nothing else, so
    // they could still sign in.
    if (!isActive) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'This account has been deactivated. Contact an administrator.' },
        { status: 403 },
      )
    }

    if (!role || (!STAFF_ROLES.includes(role) && role !== 'broker')) {
      // No CRM role means there is nowhere valid to land — the client portal runs
      // on its own OTP session and would bounce them straight back to a login page.
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'This account has no CRM role assigned. Contact an administrator.' },
        { status: 403 },
      )
    }

    // Straight to the real page: '/' is only a redirect to /dashboard, and
    // bouncing through it costs a full extra proxy pass on every login.
    // Brokers sign in here too but live in their own portal.
    return NextResponse.json({ redirectTo: role === 'broker' ? '/broker-portal' : '/dashboard' })
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
