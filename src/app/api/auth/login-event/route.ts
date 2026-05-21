import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordLoginFailure, recordLoginSuccess } from '@/lib/security/actions'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, email, userId, sessionId, deviceInfo } = body

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? '127.0.0.1'

    // Check lockout before login attempt
    if (type === 'check' && email) {
      const supabase = svc()
      const { data, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        return NextResponse.json({ ok: true })
      }
      const authUser = data.users.find((u: { email?: string }) => u.email === email)
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('lockout_until, failed_login_count')
          .eq('id', authUser.id)
          .single()

        if (profile?.lockout_until && new Date(profile.lockout_until) > new Date()) {
          const mins = Math.ceil((new Date(profile.lockout_until).getTime() - Date.now()) / 60000)
          return NextResponse.json(
            { error: `Account locked. Try again in ${mins} minute(s).` },
            { status: 423 }
          )
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (type === 'failure' && email) {
      await recordLoginFailure(email)
      return NextResponse.json({ ok: true })
    }

    if (type === 'success' && userId && sessionId) {
      await recordLoginSuccess(userId, sessionId, deviceInfo ?? '', ip)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  } catch (err) {
    console.error('[login-event]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
