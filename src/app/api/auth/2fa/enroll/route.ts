import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTOTPSecret } from '@/lib/security/totp'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, two_factor_enabled')
    .eq('id', user.id)
    .single()

  if (profile?.two_factor_enabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  }

  const accountName = profile?.full_name ?? user.email ?? 'User'
  const { secret, uri } = generateTOTPSecret(accountName)

  // Store pending secret temporarily (user must verify before we persist as enabled)
  // We store it unconfirmed — confirm happens in /verify route
  const { createClient: createSvc } = await import('@supabase/supabase-js')
  const svc = createSvc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await svc.from('profiles').update({ two_factor_secret: secret }).eq('id', user.id)

  return NextResponse.json({ secret, uri })
}
