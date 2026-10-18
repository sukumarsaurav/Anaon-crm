import { NextRequest, NextResponse, after } from 'next/server'
import { createHmac } from 'node:crypto'
import { safeEqual } from '@/lib/security/secrets'
import { ingestLead, INVALID_PHONE } from '@/lib/leads/ingest'
import {
  mirrorMessage,
  mirrorStatus,
  mirrorOptOut,
  mirrorTemplateStatus,
  type AgencyXTemplateStatusEvent,
  type AgencyXMessageEvent,
  type AgencyXStatusEvent,
  type AgencyXOptOutEvent,
} from '@/lib/whatsapp/agencyx-mirror'
import { persistWhatsAppMedia } from '@/lib/whatsapp/media'

// The signing secret AgencyX shows once when the endpoint is created (Developers →
// Webhook endpoints). Fails closed: unset → every request is rejected.
const AGENCYX_SECRET = process.env.AGENCYX_WEBHOOK_SECRET

// AgencyX signs `${t}.${rawBody}` and puts the time inside the signature, so a captured
// request cannot be replayed later. Same window AgencyX documents.
const TOLERANCE_SECONDS = 300

/**
 * `X-AgencyX-Signature: t=<unix>,v1=<hex>[,v1=<hex>]`. More than one v1 appears while
 * the secret is being rotated in AgencyX; any match is enough.
 */
function verifyAgencyXSignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false
  let timestamp: string | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2)
    if (k === 't') timestamp = v
    else if (k === 'v1' && v) signatures.push(v)
  }
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  return signatures.some((sig) => safeEqual(expected, sig))
}

interface LeadAdPayload {
  source?: {
    platform?: 'facebook' | 'instagram'
    campaign_name?: string | null
    ad_name?: string | null
    is_organic?: boolean
  }
  lead?: {
    full_name?: string | null
    phone?: string | null
    email?: string | null
    city?: string | null
    answers?: { key: string; value: string }[]
  }
}

// Answers already mapped onto lead columns; everything else (budget, preferred
// location, "when do you plan to buy"…) goes into the first note so it isn't lost.
const STANDARD_KEYS = new Set(['full_name', 'first_name', 'last_name', 'name', 'phone_number', 'phone', 'mobile_number', 'mobile', 'email', 'work_email', 'city'])

function humanise(key: string): string {
  const text = key.replace(/[_?]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// AgencyX retries every non-2xx for about eight hours. A lead whose phone isn't a usable
// Indian mobile will not gain one on retry, so it is acknowledged with the reason — which
// AgencyX keeps in its delivery log — instead of retried. Anything else (a database
// error) is a 500, so the retry can recover it.
function failure(error: string | undefined) {
  if (error === INVALID_PHONE) return NextResponse.json({ ok: false, skipped: error })
  return NextResponse.json({ error: error ?? 'Lead could not be saved' }, { status: 500 })
}

/**
 * Receives AgencyX outbound webhooks.
 *
 * In AgencyX: Developers → Webhook endpoints → Add an endpoint, URL
 * `https://<crm>/api/webhooks/agencyx`, events:
 *   - `meta.lead.received` — Facebook / Instagram Lead Ads become leads
 *   - `whatsapp.message.received` — every chat lands in the CRM WhatsApp inbox, and
 *     each new contact becomes a lead
 *   - `whatsapp.message.sent` + `whatsapp.message.status` — replies and ticks, so the
 *     CRM thread matches AgencyX's (and broadcast delivered/read counts)
 *   - `chatbot.lead.captured` — what AgencyX's AI chatbot learned, onto the lead
 *   - `whatsapp.contact.opt_out` — STOP / START, mirrored onto the conversation
 *   - `whatsapp.template.status` — Meta's review verdicts, onto the CRM's templates
 * Put the signing secret in AGENCYX_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyAgencyXSignature(rawBody, req.headers.get('x-agencyx-signature'), AGENCYX_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = req.headers.get('x-agencyx-event') ?? (body.event as string | undefined)

  if (event === 'meta.lead.received') {
    const { source, lead } = body as LeadAdPayload
    const instagram = source?.platform === 'instagram'
    const extras = (lead?.answers ?? [])
      .filter((a) => !STANDARD_KEYS.has(a.key.toLowerCase()) && a.value)
      .map((a) => `${humanise(a.key)}: ${a.value}`)
    const adLine = source?.ad_name ? `Ad: ${source.ad_name}` : null

    const result = await ingestLead({
      source: instagram ? 'instagram_ads' : 'facebook_ads',
      full_name: lead?.full_name,
      phone: lead?.phone,
      email: lead?.email,
      city: lead?.city,
      requirement: [...extras, adLine].filter(Boolean).join(' · ') || null,
      campaign_name: source?.campaign_name ?? null,
      utm_source: instagram ? 'instagram' : 'facebook',
      utm_medium: source?.is_organic ? 'organic_social' : 'paid_social',
      utm_campaign: source?.campaign_name ?? null,
    })
    if (!result.ok) return failure(result.error)
    return NextResponse.json({ ok: true, lead_id: result.id, duplicate: result.duplicate ?? false })
  }

  if (event === 'whatsapp.message.received') {
    const payload = body as AgencyXMessageEvent
    const { contact, message } = payload
    const result = await ingestLead({
      source: 'whatsapp',
      full_name: contact?.name,
      phone: contact?.phone,
      requirement: message?.type === 'text' ? message.text : null,
      utm_source: 'whatsapp',
      // Every message of an ongoing chat arrives here; only the first creates anything.
      onDuplicate: 'ignore',
    })
    // A non-Indian number gets no lead but its chat is still worth keeping, so only a
    // real ingest failure stops here.
    if (!result.ok && result.error !== INVALID_PHONE) return failure(result.error)

    if (!(await mirrorMessage(payload, 'inbound', result.id ?? null))) {
      return NextResponse.json({ error: 'Message could not be saved' }, { status: 500 })
    }
    // The file's link expires in a week; copy it once AgencyX has its 200 (10 s budget).
    if (message?.media?.url) after(() => persistWhatsAppMedia(message.id))
    return NextResponse.json({ ok: true, lead_id: result.id ?? null, duplicate: result.duplicate ?? false })
  }

  // AgencyX's AI chatbot qualified the chat. The contact is usually a lead already (from
  // their first message); this adds what the bot learned to it.
  if (event === 'chatbot.lead.captured') {
    const { lead, chatbot } = body as {
      chatbot?: { name?: string | null }
      lead?: {
        full_name?: string | null
        phone?: string | null
        email?: string | null
        /** Primary field — the interest string from the chatbot. */
        interest?: string | null
        /** Legacy alias kept for receivers built against v1 of this event. */
        destination_interest?: string | null
        notes?: string | null
      }
    }
    // Prefer lead.interest (the current field name); fall back to destination_interest for
    // events delivered during a version transition.
    const interest = lead?.interest ?? lead?.destination_interest
    const details = [interest && `Interest: ${interest}`, lead?.notes]
      .filter(Boolean).join(' · ')
    const result = await ingestLead({
      source: 'whatsapp',
      full_name: lead?.full_name,
      phone: lead?.phone,
      email: lead?.email,
      requirement: `Qualified by ${chatbot?.name ?? 'the WhatsApp chatbot'}${details ? ` — ${details}` : ''}`,
      utm_source: 'whatsapp',
      utm_medium: 'chatbot',
    })
    if (!result.ok) return failure(result.error)
    return NextResponse.json({ ok: true, lead_id: result.id, duplicate: result.duplicate ?? false })
  }

  // Replies from AgencyX — a person in its inbox, its bot, a keyword rule, the API, or
  // typed on the phone in the WhatsApp Business app — so the CRM shows both sides.
  if (event === 'whatsapp.message.sent') {
    const payload = body as AgencyXMessageEvent
    if (!(await mirrorMessage(payload, 'outbound', null))) {
      return NextResponse.json({ error: 'Message could not be saved' }, { status: 500 })
    }
    if (payload.message?.media?.url) after(() => persistWhatsAppMedia(payload.message?.id))
    return NextResponse.json({ ok: true })
  }

  if (event === 'whatsapp.message.status') {
    if (!(await mirrorStatus(body as AgencyXStatusEvent))) {
      return NextResponse.json({ error: 'Status could not be saved' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // A customer replied STOP or START. Mirror their opt-out flag so every marketing send
  // can check it without asking AgencyX. AgencyX also sets contact.opted_out on every
  // received message, but this event is the authoritative source for changes.
  if (event === 'whatsapp.contact.opt_out') {
    if (!(await mirrorOptOut(body as AgencyXOptOutEvent))) {
      return NextResponse.json({ error: 'Opt-out could not be saved' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Meta approved, rejected, paused, disabled or reinstated a template: the CRM's copy
  // follows at once, so a broadcast can go out without anyone pressing Sync.
  if (event === 'whatsapp.template.status') {
    if (!(await mirrorTemplateStatus(body as AgencyXTemplateStatusEvent))) {
      return NextResponse.json({ error: 'Template status could not be saved' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ping (the "Send test" button) and any event we don't act on: acknowledge, so
  // AgencyX doesn't retry or count it against the endpoint.
  return NextResponse.json({ ok: true, ignored: event ?? null })
}
