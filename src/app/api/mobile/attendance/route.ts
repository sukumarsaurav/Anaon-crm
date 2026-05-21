import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'

export async function GET(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, supabase } = auth
  const url = new URL(req.url)
  const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .gte('check_in_time', `${date}T00:00:00`)
    .lte('check_in_time', `${date}T23:59:59`)
    .order('check_in_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, supabase } = auth
  const body = await req.json()
  const { action, lat, lng } = body // action: 'check_in' | 'check_out'

  if (action === 'check_in') {
    const { data, error } = await supabase.from('attendance').insert({
      user_id: user.id,
      check_in_time: new Date().toISOString(),
      check_in_lat: lat,
      check_in_lng: lng,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  }

  if (action === 'check_out') {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .gte('check_in_time', `${todayStr}T00:00:00`)
      .is('check_out_time', null)
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'No open check-in found' }, { status: 404 })

    await supabase.from('attendance').update({
      check_out_time: new Date().toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
    }).eq('id', existing.id)

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
