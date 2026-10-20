import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSecuritySettings, getUserGate } from '@/lib/security/proxyCache'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/mobile',
  '/api/webhooks',
  '/api/cron',
  '/api/portal',
  '/share',
  '/broker-portal',
  '/client-portal',
]

const STAFF_ROLES = ['admin', 'manager', 'sales_advisor', 'telecaller']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets — always allow
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // The project signs JWTs with an asymmetric key (ES256), so getClaims()
  // verifies the token locally via WebCrypto against a cached JWKS — no network
  // call, unlike getUser(). It still refreshes an about-to-expire session, so
  // cookie rotation keeps working.
  //
  // Trade-off vs getUser(): a token stays valid locally until it expires, so a
  // user deleted or banned mid-session keeps passing this gate for the
  // remainder of their access token's life. Mutations still go through RLS,
  // which is evaluated by the database against live state.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null

  // Public paths — let through, redirect logged-in users away from /login (by role).
  if (isPublic(pathname)) {
    if (userId && pathname === '/login') {
      const { role } = await getUserGate(supabase, userId)
      const isStaff = !!role && STAFF_ROLES.includes(role)
      return NextResponse.redirect(new URL(isStaff ? '/dashboard' : role === 'broker' ? '/broker-portal' : '/client-portal', request.url))
    }
    return supabaseResponse
  }

  // Not authenticated → login
  if (!userId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // IP whitelist (dashboard routes only, skip API)
  if (!pathname.startsWith('/api')) {
    const { ipWhitelistEnabled } = await getSecuritySettings(supabase)

    if (ipWhitelistEnabled) {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-real-ip')
        ?? '127.0.0.1'

      const { data: allowed } = await supabase
        .from('ip_whitelist')
        .select('id')
        .eq('ip_address', clientIp)
        .eq('is_active', true)
        .maybeSingle()

      if (!allowed) {
        return new NextResponse('Access denied: IP not whitelisted', { status: 403 })
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
