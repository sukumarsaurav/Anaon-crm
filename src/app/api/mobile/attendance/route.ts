import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { todayIST } from '@/lib/datetime'

/**
 * Field check-in / check-out from the mobile app.
 *
 * Writes `attendance_logs` (one row per person per IST day), the table Team, HR and payroll read.
 * It used to write a separate `attendance` table, so mobile check-ins never showed up anywhere in the
 * CRM. The response keeps the old field names (check_in_time / check_out_time) for the app.
 */

type Log = {
  id: string; user_id: string; date: string; status: string; notes: string | null
  check_in_at: string | null; check_out_at: string | null
  check_in_lat: number | null; check_in_lng: number | null; check_out_lat: number | null; check_out_lng: number | null
}

function toAppShape(l: Log | null) {
  if (!l) return null
  return {
    id: l.id, user_id: l.user_id, date: l.date, status: l.status, notes: l.notes,
    check_in_time: l.check_in_at, check_out_time: l.check_out_at,
    check_in_lat: l.check_in_lat, check_in_lng: l.check_in_lng,
    check_out_lat: l.check_out_lat, check_out_lng: l.check_out_lng,
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export async function GET(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, supabase } = auth
  const requested = new URL(req.url).searchParams.get('date')
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayIST()

  const { data, error } = await supabase
    .from('attendance_logs').select('*').eq('user_id', user.id).eq('date', day).maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(toAppShape(data as Log | null))
}

export async function POST(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, supabase } = auth
  const body = await req.json().catch(() => ({}))
  const { action } = body as { action?: string }
  const lat = num(body?.lat)
  const lng = num(body?.lng)
  const day = todayIST()
  const now = new Date().toISOString()

  const { data: today } = await supabase
    .from('attendance_logs').select('id, check_in_at, check_out_at').eq('user_id', user.id).eq('date', day).maybeSingle()

  if (action === 'check_in') {
    // A double tap (or a retry) must not move the check-in time.
    if (today?.check_in_at) return NextResponse.json({ error: 'Already checked in', id: today.id }, { status: 409 })

    const { data, error } = await supabase.from('attendance_logs').upsert({
      user_id: user.id, date: day, status: 'present',
      check_in_at: now, check_in_lat: lat, check_in_lng: lng, updated_at: now,
    }, { onConflict: 'user_id,date' }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  }

  if (action === 'check_out') {
    if (!today?.check_in_at || today.check_out_at) {
      return NextResponse.json({ error: 'No open check-in found' }, { status: 404 })
    }
    const { error } = await supabase.from('attendance_logs').update({
      check_out_at: now, check_out_lat: lat, check_out_lng: lng, updated_at: now,
    }).eq('id', today.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
