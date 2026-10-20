import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'

const IST_MS = 330 * 60_000
/** The IST calendar day (YYYY-MM-DD) for an instant, and that day's bounds as UTC instants. */
function istDay(at = new Date()) {
  const day = new Date(at.getTime() + IST_MS).toISOString().split('T')[0]
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - IST_MS)
  return { day, start: start.toISOString(), end: new Date(start.getTime() + 86_400_000 - 1).toISOString() }
}

export async function GET(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, supabase } = auth
  const url = new URL(req.url)
  // Days are IST days: a check-in at 01:00 IST belongs to that IST date, not the previous UTC one.
  const requested = url.searchParams.get('date')
  const { start, end } = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? { start: new Date(Date.parse(`${requested}T00:00:00Z`) - IST_MS).toISOString(), end: new Date(Date.parse(`${requested}T00:00:00Z`) - IST_MS + 86_400_000 - 1).toISOString() }
    : istDay()

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .gte('check_in_time', start)
    .lte('check_in_time', end)
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
    // One open check-in at a time: a double tap (or a retry) used to create a second open row.
    const { data: open } = await supabase.from('attendance').select('id')
      .eq('user_id', user.id).gte('check_in_time', istDay().start).is('check_out_time', null).limit(1).maybeSingle()
    if (open) return NextResponse.json({ error: 'Already checked in', id: open.id }, { status: 409 })

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
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .gte('check_in_time', istDay().start)
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
