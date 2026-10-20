import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LAST_SEEN_COOKIE } from '@/lib/security/proxyCache'

/**
 * Ends the session and returns to the login page. Server components cannot clear cookies, so a layout
 * that has to turn someone away (a deactivated account) redirects here instead of to /login — which the
 * proxy would bounce straight back to the dashboard while the session cookie was still valid.
 * `/api/auth` is public in the proxy.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const reason = req.nextUrl.searchParams.get('reason')
  const url = new URL('/login', req.url)
  if (reason === 'deactivated' || reason === 'timeout') url.searchParams.set('reason', reason)
  const res = NextResponse.redirect(url)
  res.cookies.delete(LAST_SEEN_COOKIE)
  return res
}
