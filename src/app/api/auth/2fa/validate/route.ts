import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTOTPSecretForUser, verifyTOTPCode } from '@/lib/security/totp'
import { writeAuditLog } from '@/lib/security/audit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const secret = await getTOTPSecretForUser(user.id)
  if (!secret) return NextResponse.json({ error: '2FA not configured' }, { status: 400 })

  const valid = verifyTOTPCode(secret, code)
  if (!valid) {
    await writeAuditLog({ userId: user.id, action: '2fa_failed', metadata: { phase: 'login' } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  await writeAuditLog({ userId: user.id, action: 'login', metadata: { mfa: true } })

  // Set mfa_verified cookie (httpOnly, same-site, 8h)
  const res = NextResponse.json({ success: true })
  res.cookies.set('mfa_verified', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60,
    path: '/',
  })
  return res
}
