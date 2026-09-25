import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { matchesSecret } from '@/lib/security/secrets'

// Fail closed: unset env → endpoint rejects everything. Configure the Exotel
// callback URL as .../api/webhooks/exotel?token=<EXOTEL_WEBHOOK_TOKEN>.
const EXOTEL_WEBHOOK_TOKEN = process.env.EXOTEL_WEBHOOK_TOKEN

function authorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get('token') ?? req.headers.get('x-webhook-token')
  return matchesSecret(EXOTEL_WEBHOOK_TOKEN, token)
}

/**
 * Exotel call status callback. Completes the click-to-call activity (recording +
 * duration) by CallSid, or logs an inbound call by matching the customer phone.
 * Accepts both form-encoded (POST) and query (GET) per Exotel config.
 */
async function handle(params: URLSearchParams) {
  const callSid = params.get('CallSid')
  const recordingUrl = params.get('RecordingUrl')
  const status = params.get('Status') ?? params.get('DialCallStatus')
  const durationStr = params.get('ConversationDuration') ?? params.get('DialCallDuration')
  const duration = durationStr ? parseInt(durationStr, 10) : null
  // For inbound, the customer is the caller (From); for outbound, the dialed number (To).
  const customer = params.get('From') ?? params.get('To')

  const supabase = createServiceClient()

  // 1. Match an existing (outbound) activity by CallSid.
  if (callSid) {
    const { data: existing } = await supabase
      .from('lead_activities')
      .select('id, notes')
      .eq('call_sid', callSid)
      .maybeSingle()

    if (existing) {
      await supabase.from('lead_activities').update({
        recording_url: recordingUrl ?? null,
        call_duration_seconds: duration,
        notes: `Outbound call — ${status ?? 'completed'}${duration ? ` (${duration}s)` : ''}`,
      }).eq('id', existing.id)
      return
    }
  }

  // 2. Otherwise treat as inbound: match a lead by phone (last 10 digits).
  if (customer) {
    const last10 = customer.replace(/\D/g, '').slice(-10)
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .ilike('phone', `%${last10}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (lead) {
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        type: 'call',
        notes: `Inbound call — ${status ?? 'received'}${duration ? ` (${duration}s)` : ''}`,
        call_sid: callSid ?? null,
        recording_url: recordingUrl ?? null,
        call_duration_seconds: duration,
        performed_by: null,
      })
    }
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let params: URLSearchParams
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    params = new URLSearchParams(body as Record<string, string>)
  } else {
    const text = await req.text()
    params = new URLSearchParams(text)
  }
  await handle(params)
  return NextResponse.json({ status: 'ok' })
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await handle(req.nextUrl.searchParams)
  return NextResponse.json({ status: 'ok' })
}
