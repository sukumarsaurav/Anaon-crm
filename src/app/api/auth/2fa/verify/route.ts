import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyTOTPCode, enableTOTP } from '@/lib/security/totp'
import { writeAuditLog } from '@/lib/security/audit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  // Get the pending secret
  const { data: profile } = await supabase
    .from('profiles')
    .select('two_factor_secret, two_factor_enabled')
    .eq('id', user.id)
    .single()

  if (!profile?.two_factor_secret) {
    return NextResponse.json({ error: 'No pending enrollment. Start enrollment first.' }, { status: 400 })
  }

  const valid = verifyTOTPCode(profile.two_factor_secret, code)
  if (!valid) {
    await writeAuditLog({ userId: user.id, action: '2fa_failed', metadata: { phase: 'enrollment' } })
    return NextResponse.json({ error: 'Invalid code. Try again.' }, { status: 400 })
  }

  // Confirm 2FA enabled
  await enableTOTP(user.id, profile.two_factor_secret)
  await writeAuditLog({ userId: user.id, action: '2fa_enabled' })

  return NextResponse.json({ success: true })
}
