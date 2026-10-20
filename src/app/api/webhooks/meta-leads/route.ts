import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { matchesSecret, verifyHmacSha256 } from '@/lib/security/secrets'
import { ingestLead, INVALID_PHONE } from '@/lib/leads/ingest'

// Fail closed: unset env → no valid token / no valid signature.
const META_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
const META_APP_SECRET = process.env.META_APP_SECRET

// GET — webhook verification by Meta
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && matchesSecret(META_VERIFY_TOKEN, token)) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * POST — lead-ad events from Meta. Each lead goes through ingestLead like every other
 * source (dedupe, assignment, scoring, notification, automations).
 *
 * An event is only marked processed once its lead exists. A failure that a retry can fix
 * (Graph API down, DB error) answers 500, so Meta redelivers it and the unprocessed event
 * row is picked up again; one that can't (no usable phone) is recorded and acknowledged.
 */
export async function POST(req: NextRequest) {
  // Verify the payload actually came from Meta (HMAC over the raw body) before
  // trusting anything in it — the handler writes via the service-role client.
  const rawBody = await req.text()
  if (!verifyHmacSha256(rawBody, req.headers.get('x-hub-signature-256'), META_APP_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  type LeadgenChange = { field?: string; value?: Record<string, string | undefined> }
  let body: { entry?: { changes?: LeadgenChange[] }[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let retryable = false

  const entries = body?.entry ?? []
  for (const entry of entries) {
    const changes = entry?.changes ?? []
    for (const change of changes) {
      if (change.field !== 'leadgen') continue
      const value = change.value ?? {}
      if (!value.leadgen_id) continue
      const eventId = `${value.leadgen_id}:${value.form_id}`

      const { data: existing } = await supabase
        .from('meta_lead_webhook_events')
        .select('id, processed')
        .eq('event_id', eventId)
        .maybeSingle()
      if (existing?.processed) continue

      const record = async (fields: Record<string, unknown>) => {
        await supabase.from('meta_lead_webhook_events').upsert({
          event_id: eventId,
          leadgen_id: value.leadgen_id,
          form_id: value.form_id ?? null,
          page_id: value.page_id ?? null,
          ad_id: value.ad_id ?? null,
          adset_id: value.adgroup_id ?? value.adset_id ?? null,
          campaign_id: value.campaign_id ?? null,
          payload: value,
          ...fields,
        }, { onConflict: 'event_id' })
      }

      let lead: MetaLead
      try {
        lead = await fetchMetaLead(value.leadgen_id)
      } catch (e) {
        await record({ processed: false, error_message: (e as Error).message })
        retryable = true
        continue
      }

      const instagram = lead.platform === 'ig' || lead.platform === 'instagram'
      const result = await ingestLead({
        source: instagram ? 'instagram_ads' : 'facebook_ads',
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        requirement: lead.extras.length ? lead.extras.join(' · ') : null,
        campaign_name: lead.campaign_name ?? null,
        ad_set_name: lead.adset_name ?? null,
        meta_campaign_id: lead.campaign_id ?? value.campaign_id ?? null,
        utm_source: instagram ? 'instagram' : 'facebook',
        utm_medium: lead.is_organic ? 'organic_social' : 'paid_social',
        utm_campaign: lead.campaign_name ?? null,
      })

      if (!result.ok) {
        // A lead without a usable phone will never ingest; anything else is worth a retry.
        const permanent = result.error === INVALID_PHONE
        await record({ processed: permanent, error_message: result.error ?? 'Lead could not be created' })
        if (!permanent) retryable = true
        continue
      }

      await record({
        processed: true,
        error_message: null,
        lead_id: result.id ?? null,
        campaign_id: lead.campaign_id ?? value.campaign_id ?? null,
        adset_id: lead.adset_id ?? value.adgroup_id ?? value.adset_id ?? null,
        ad_id: lead.ad_id ?? value.ad_id ?? null,
      })
    }
  }

  if (retryable) return NextResponse.json({ status: 'retry' }, { status: 500 })
  return NextResponse.json({ status: 'ok' })
}

interface MetaLead {
  name?: string
  phone?: string
  email?: string
  city?: string
  /** Answers that have no lead column (budget, timeline…), kept as the first note. */
  extras: string[]
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  /** 'fb' | 'ig' */
  platform?: string
  is_organic?: boolean
}

const STANDARD_FIELDS = new Set(['full_name', 'name', 'first_name', 'last_name', 'phone_number', 'phone', 'email', 'city'])

async function fetchMetaLead(leadgenId: string): Promise<MetaLead> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN not configured')

  const fields = 'field_data,campaign_id,campaign_name,adset_id,adset_name,ad_id,platform,is_organic'
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}?fields=${fields}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  if (!res.ok) throw new Error(`Meta API error ${res.status}`)
  const data = await res.json()

  const lead: MetaLead = {
    extras: [],
    campaign_id: data.campaign_id,
    campaign_name: data.campaign_name,
    adset_id: data.adset_id,
    adset_name: data.adset_name,
    ad_id: data.ad_id,
    platform: data.platform,
    is_organic: Boolean(data.is_organic),
  }
  let first: string | undefined
  let last: string | undefined
  for (const field of data.field_data ?? []) {
    const key = String(field.name ?? '').toLowerCase()
    const val = field.values?.[0]
    if (!val) continue
    if (key === 'full_name' || key === 'name') lead.name = val
    else if (key === 'first_name') first = val
    else if (key === 'last_name') last = val
    else if (key === 'phone_number' || key === 'phone') lead.phone = val
    else if (key === 'email') lead.email = val
    else if (key === 'city') lead.city = val
    else if (!STANDARD_FIELDS.has(key)) {
      const label = key.replace(/[_?]+/g, ' ').trim()
      lead.extras.push(`${label.charAt(0).toUpperCase()}${label.slice(1)}: ${val}`)
    }
  }
  if (!lead.name && (first || last)) lead.name = [first, last].filter(Boolean).join(' ')
  return lead
}
