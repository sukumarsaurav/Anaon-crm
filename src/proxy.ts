import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/verify-2fa',
  '/api/auth',
  '/api/mobile',
  '/api/webhooks',
  '/api/cron',
  '/api/portal',
  '/share',
  '/broker-portal',
  '/client-portal',
]

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

  const { data: { user } } = await supabase.auth.getUser()

  // Public paths — let through, redirect logged-in users away from /login
  if (isPublic(pathname)) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/leads', request.url))
    }
    return supabaseResponse
  }

  // Not authenticated → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2FA gate: admin/manager with 2FA enabled must verify per browser session
  if (pathname !== '/verify-2fa') {
    const mfaVerified = request.cookies.get('mfa_verified')?.value
    if (!mfaVerified) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, two_factor_enabled')
        .eq('id', user.id)
        .single()

      if (profile?.two_factor_enabled && ['admin', 'manager'].includes(profile.role)) {
        return NextResponse.redirect(new URL('/verify-2fa', request.url))
      }
    }
  }

  // IP whitelist (dashboard routes only, skip API)
  if (!pathname.startsWith('/api')) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? '127.0.0.1'

    const { data: settings } = await supabase
      .from('security_settings')
      .select('ip_whitelist_enabled')
      .limit(1)
      .maybeSingle()

    if (settings?.ip_whitelist_enabled) {
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
