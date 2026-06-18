import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Register a push device for the current user.
 * Body: { platform: 'expo', expoToken } | { platform: 'web', subscription }
 */
export async function POST(req: NextRequest) {
  const user = (await getProfile())?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const supabase = createServiceClient()

  if (body.platform === 'expo' && body.expoToken) {
    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      platform: 'expo',
      expo_token: body.expoToken,
      endpoint: body.expoToken,
      user_agent: body.userAgent ?? null,
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    return NextResponse.json({ ok: true })
  }

  if (body.platform === 'web' && body.subscription?.endpoint) {
    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      platform: 'web',
      web_subscription: body.subscription,
      endpoint: body.subscription.endpoint,
      user_agent: req.headers.get('user-agent'),
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'platform/token required' }, { status: 400 })
}
