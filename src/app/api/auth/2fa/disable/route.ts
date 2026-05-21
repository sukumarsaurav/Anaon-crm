import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { disableTOTP } from '@/lib/security/totp'
import { writeAuditLog } from '@/lib/security/audit'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await disableTOTP(user.id)
  await writeAuditLog({ userId: user.id, action: '2fa_disabled' })

  return NextResponse.json({ success: true })
}
