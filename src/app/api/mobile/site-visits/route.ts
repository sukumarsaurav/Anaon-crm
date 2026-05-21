import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'

export async function POST(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, supabase } = auth
  const body = await req.json()
  const { lead_id, check_in_lat, check_in_lng, outcome, notes, photos } = body

  if (!lead_id || !outcome) {
    return NextResponse.json({ error: 'lead_id and outcome are required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('site_visits').insert({
    lead_id,
    visited_by: user.id,
    visit_date: now,
    visited_at: now,
    gps_checkin_lat: check_in_lat,
    gps_checkin_lng: check_in_lng,
    outcome,
    notes,
    advisor_notes: notes,
    photos: photos ? JSON.stringify(photos) : '[]',
    status: 'completed',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const statusMap: Record<string, string> = {
    interested: 'site_visit_done',
    negotiation: 'negotiation',
    not_interested: 'lost',
    follow_up: 'site_visit_done',
  }
  const newStatus = statusMap[outcome]
  if (newStatus) {
    await supabase.from('leads').update({ status: newStatus }).eq('id', lead_id)
  }

  await supabase.from('lead_activities').insert({
    lead_id,
    type: 'site_visit',
    notes: `Site visit completed. Outcome: ${outcome}. ${notes ?? ''}`.trim(),
    created_by: user.id,
  })

  return NextResponse.json({ success: true, id: data.id })
}
