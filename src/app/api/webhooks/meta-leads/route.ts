import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const META_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'anon_india_meta_verify'

// GET — webhook verification by Meta
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST — incoming lead events from Meta
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const entries = body?.entry ?? []
  for (const entry of entries) {
    const changes = entry?.changes ?? []
    for (const change of changes) {
      if (change.field !== 'leadgen') continue
      const value = change.value
      const eventId = `${value.leadgen_id}:${value.form_id}`

      // Dedup: skip if already processed
      const { data: existing } = await supabase
        .from('meta_lead_webhook_events')
        .select('id')
        .eq('event_id', eventId)
        .single()
      if (existing) continue

      // Fetch lead details from Meta Graph API
      let leadData: MetaLeadFields | null = null
      let errorMsg: string | null = null
      try {
        leadData = await fetchMetaLeadData(value.leadgen_id)
      } catch (e) {
        errorMsg = (e as Error).message
      }

      // Insert webhook event record
      const { data: eventRow } = await supabase
        .from('meta_lead_webhook_events')
        .insert({
          event_id:    eventId,
          leadgen_id:  value.leadgen_id,
          form_id:     value.form_id,
          page_id:     value.page_id,
          ad_id:       value.ad_id ?? null,
          campaign_id: value.campaign_id ?? null,
          adset_id:    value.adset_id ?? null,
          payload:     value,
          error_message: errorMsg,
        })
        .select('id')
        .single()

      if (!leadData || !eventRow) continue

      const phone = normalizePhone(leadData.phone)
      if (!phone) {
        await supabase
          .from('meta_lead_webhook_events')
          .update({ error_message: 'No phone in lead data', processed: false })
          .eq('id', eventRow.id)
        continue
      }

      // Check for duplicate lead by phone
      const { data: dupCheck } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', phone)
        .single()

      let leadId: string | null = null
      if (!dupCheck) {
        // Create new lead
        const source = platformToSource(value.page_id)
        const { data: newLead } = await supabase
          .from('leads')
          .insert({
            full_name:       leadData.name ?? 'Meta Lead',
            phone,
            email:           leadData.email ?? null,
            source,
            utm_source:      source,
            utm_medium:      'social',
            utm_campaign:    leadData.campaign_name ?? null,
            campaign_name:   leadData.campaign_name ?? null,
            ad_set_name:     leadData.adset_name ?? null,
            whatsapp_opt_in: true,
          })
          .select('id')
          .single()
        leadId = newLead?.id ?? null
      } else {
        leadId = dupCheck.id
      }

      await supabase
        .from('meta_lead_webhook_events')
        .update({ lead_id: leadId, processed: true })
        .eq('id', eventRow.id)
    }
  }

  return NextResponse.json({ status: 'ok' })
}

interface MetaLeadFields {
  name?: string
  phone?: string
  email?: string
  campaign_name?: string
  adset_name?: string
}

async function fetchMetaLeadData(leadgenId: string): Promise<MetaLeadFields> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN not configured')

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${token}&fields=field_data,campaign_name,adset_name`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Meta API error ${res.status}`)
  const data = await res.json()

  const result: MetaLeadFields = {
    campaign_name: data.campaign_name,
    adset_name: data.adset_name,
  }
  for (const field of data.field_data ?? []) {
    const val = field.values?.[0]
    if (field.name === 'full_name' || field.name === 'name') result.name = val
    else if (field.name === 'phone_number' || field.name === 'phone') result.phone = val
    else if (field.name === 'email') result.email = val
  }
  return result
}

function normalizePhone(raw?: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 10) return digits
  return null
}

function platformToSource(pageId?: string): string {
  // Can be made smarter by mapping known page IDs
  return 'facebook'
}
