import { randomUUID } from 'node:crypto'

/**
 * Client for AgencyX's Send API. AgencyX owns the WhatsApp number (it holds the Meta
 * token, runs the bot and keyword rules), so every message the CRM sends goes out through
 * here when AGENCYX_API_KEY is set. AgencyX echoes each send back as
 * `whatsapp.message.sent`; the mirror dedupes it on wa_message_id.
 *
 *   AGENCYX_API_KEY  — a key from AgencyX → Developers → Send API (scope whatsapp:send).
 *                      `ax_test_…` validates without sending; `ax_live_…` sends.
 *   AGENCYX_API_URL  — optional; defaults to AgencyX's production endpoint
 *   AGENCYX_FROM     — optional phone_number_id; required by AgencyX only when the
 *                      account has more than one WhatsApp number
 *
 * Contract: AgencyX Webhook & Send API Guide.
 *
 * Variables are sent as a named object (e.g. { "Customer name": "Ravi" }) so the API
 * can validate them and reorder a template without silently misplacing values. Templates
 * created before naming existed fall back to "1", "2", … — GET /v1/templates tells you
 * the exact keys for each template.
 */
const API_URL = process.env.AGENCYX_API_URL
  ?? 'https://tsbyhkbphupsaupryefo.supabase.co/functions/v1/whatsapp-api'
const API_KEY = process.env.AGENCYX_API_KEY
const DEFAULT_FROM = process.env.AGENCYX_FROM || null

export function agencyXConfigured(): boolean {
  return Boolean(API_KEY)
}

export interface AgencyXSendResult {
  success: boolean
  messageId?: string
  error?: string
  /** 409 window_closed: free text / media is not allowed outside the 24-hour window. */
  windowClosed?: boolean
  /** 409 opted_out: respect_opt_out was true and the contact replied STOP. */
  optedOut?: boolean
  /** 429: the key's per-minute limit. Stop the batch; resume later. */
  rateLimited?: boolean
  /** true when the same client_reference was already sent — original result returned. */
  idempotentReplay?: boolean
}

export interface AgencyXLookupResult extends AgencyXSendResult {
  status?: string
  deliveredAt?: string | null
  readAt?: string | null
}

interface CallResult {
  ok: boolean
  status: number
  data: Record<string, unknown>
}

async function call(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<CallResult> {
  if (!API_KEY) {
    return {
      ok: false,
      status: 0,
      data: { error: 'AGENCYX_API_KEY is not set — WhatsApp sends through AgencyX are disabled' },
    }
  }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } }
  }
}

function errorOf(status: number, data: Record<string, unknown>): string {
  if (data.error === 'window_closed') {
    return 'The customer has not messaged in the last 24 hours, so WhatsApp only allows an approved template. Send a template instead.'
  }
  if (data.error === 'opted_out') {
    return `Contact has opted out of WhatsApp marketing (opted_out_at: ${data.opted_out_at ?? 'unknown'})`
  }
  const base = String(data.error ?? data.message ?? `AgencyX send failed (${status || 'network error'})`)
  // A missing/unknown variable comes back with the names the template expects — that
  // list is the fix, so keep it in the message.
  return Array.isArray(data.variables)
    ? `${base} (expects: ${(data.variables as string[]).join(', ')})`
    : base
}

/**
 * Sends one message. `reference` is AgencyX's idempotency key: pass a stable id for the
 * thing the message is about (broadcast recipient, automation log, OTP request) and a
 * retry can never message the customer twice. Without one, the send is one-off.
 *
 * `pauseAutoReply` is for a person replying: it switches AgencyX's bot off on this chat,
 * as replying from the AgencyX inbox does, so the customer isn't answered by both.
 *
 * `respectOptOut` should be true for marketing sends.
 * `categoryHint: "utility"` bypasses opt-out checks for OTPs / receipts.
 *
 * Template variables are sent as a named object (keys = template variable names from
 * GET /v1/templates). Positional arrays are also accepted by the API and by this function.
 */
export async function sendViaAgencyX(input: {
  to: string
  from?: string | null
  text?: string
  template?: {
    name: string
    language?: string
    /** Named variables preferred: { "Customer name": "Ravi" }. Positional array also accepted. */
    variables: Record<string, string> | string[]
    /** Values for dynamic URL / coupon / OTP buttons, in GET /v1/templates button_variables order. */
    buttonVariables?: string[]
  }
  media?: {
    type: 'image' | 'video' | 'audio' | 'document'
    url: string
    filename?: string
    caption?: string
  }
  reference?: string
  pauseAutoReply?: boolean
  respectOptOut?: boolean
  categoryHint?: 'marketing' | 'utility'
}): Promise<AgencyXSendResult> {
  let messageBody: Record<string, unknown>

  if (input.text !== undefined) {
    messageBody = { text: input.text }
  } else if (input.media !== undefined) {
    messageBody = {
      media: {
        type: input.media.type,
        url: input.media.url,
        ...(input.media.filename ? { filename: input.media.filename } : {}),
        ...(input.media.caption ? { caption: input.media.caption } : {}),
      },
    }
  } else {
    const tpl = input.template!
    messageBody = {
      template: tpl.name,
      ...(tpl.language ? { language: tpl.language } : {}),
      variables: tpl.variables,
      ...(tpl.buttonVariables?.length ? { button_variables: tpl.buttonVariables } : {}),
    }
  }

  const body: Record<string, unknown> = {
    to: input.to,
    ...((input.from ?? DEFAULT_FROM) ? { from: input.from ?? DEFAULT_FROM } : {}),
    ...messageBody,
    client_reference: (input.reference ?? `crm_${randomUUID()}`).slice(0, 200),
    ...(input.pauseAutoReply ? { pause_auto_reply: true } : {}),
    ...(input.respectOptOut ? { respect_opt_out: true } : {}),
    ...(input.categoryHint ? { category_hint: input.categoryHint } : {}),
  }

  let res = await call('POST', '/v1/messages', body)
  // 502 = WhatsApp unreachable; safe to retry with the same reference (idempotent).
  if (res.status === 502 || res.status === 0) {
    await new Promise((r) => setTimeout(r, 1000))
    res = await call('POST', '/v1/messages', body)
  }

  const { ok, status, data } = res
  if (!ok || data.status === 'failed') {
    return {
      success: false,
      error: errorOf(status, data),
      windowClosed: data.error === 'window_closed',
      optedOut: data.error === 'opted_out',
      rateLimited: status === 429,
    }
  }
  return {
    success: true,
    messageId: (data.message_id as string | null) ?? undefined,
    idempotentReplay: Boolean(data.idempotent_replay),
  }
}

/**
 * Looks up a previously sent message by its client_reference.
 * Returns the same shape as a send, plus delivered_at / read_at once receipts arrive.
 */
export async function lookupAgencyXMessage(clientReference: string): Promise<AgencyXLookupResult> {
  const { ok, status, data } = await call(
    'GET',
    `/v1/messages/${encodeURIComponent(clientReference)}`,
  )
  if (!ok) return { success: false, error: errorOf(status, data) }
  return {
    success: true,
    messageId: (data.message_id as string | null) ?? undefined,
    status: data.status as string | undefined,
    deliveredAt: (data.delivered_at as string | null) ?? null,
    readAt: (data.read_at as string | null) ?? null,
  }
}

/** The CRM's Bot ON/OFF switch, applied to AgencyX's chatbot and keyword rules. */
export async function setAgencyXAutoReply(
  to: string,
  enabled: boolean,
  from?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const { ok, status, data } = await call('POST', '/v1/conversations/auto-reply', {
    to,
    enabled,
    ...((from ?? DEFAULT_FROM) ? { from: from ?? DEFAULT_FROM } : {}),
  })
  return ok ? { success: true } : { success: false, error: errorOf(status, data) }
}

export interface AgencyXTemplate {
  name: string
  language: string
  category: string | null
  /** APPROVED | PENDING | REJECTED | PAUSED | DISABLED */
  status: string
  rejected_reason: string | null
  from: string | null
  display_phone_number: string | null
  body: string | null
  header: 'none' | 'text' | 'image' | 'video' | 'document'
  header_text: string | null
  header_media_url: string | null
  footer: string | null
  buttons: { type: string; text: string; url?: string; phone_number?: string }[]
  /** The keys `variables` takes, in {{1}}, {{2}}… order. */
  variables: string[]
  /** Buttons that need a per-send value (dynamic URL suffix, coupon code, OTP). */
  button_variables: string[]
  /** true only when approved and, for a media header, the file is stored. */
  sendable: boolean
}

/** Templates AgencyX has on the connected number(s). Approved-only by default; pass statusAll=true for all. */
export async function listAgencyXTemplates(
  statusAll = false,
): Promise<{ success: boolean; templates?: AgencyXTemplate[]; error?: string }> {
  const params = new URLSearchParams({
    ...(DEFAULT_FROM ? { from: DEFAULT_FROM } : {}),
    ...(statusAll ? { status: 'all' } : {}),
  })
  const path = `/v1/templates${params.size ? `?${params}` : ''}`
  const { ok, status, data } = await call('GET', path)
  if (!ok) return { success: false, error: errorOf(status, data) }
  return { success: true, templates: (data.templates as AgencyXTemplate[]) ?? [] }
}

// AgencyXTemplateStatus is the same shape as AgencyXTemplate (status field is already there).
export type AgencyXTemplateStatus = AgencyXTemplate

/**
 * Every template on the number with its review state, after asking AgencyX to refresh
 * from Meta (review is asynchronous — minutes to a day).
 */
export async function syncAgencyXTemplateStatuses(): Promise<{
  success: boolean
  templates?: AgencyXTemplateStatus[]
  error?: string
}> {
  const sync = await call('POST', '/v1/templates/sync', DEFAULT_FROM ? { from: DEFAULT_FROM } : {})
  if (!sync.ok) return { success: false, error: errorOf(sync.status, sync.data) }
  const qs = new URLSearchParams({ status: 'all', ...(DEFAULT_FROM ? { from: DEFAULT_FROM } : {}) })
  const { ok, status, data } = await call('GET', `/v1/templates?${qs}`)
  if (!ok) return { success: false, error: errorOf(status, data) }
  return { success: true, templates: (data.templates as AgencyXTemplateStatus[]) ?? [] }
}

export interface SubmitTemplateInput {
  name: string
  language: string
  category: 'MARKETING' | 'UTILITY'
  body: string // positional {{1}}…{{n}}
  headerText?: string | null
  /** A media header instead of a text header. Fetched once; stored and shown on every send. */
  header?: { format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url: string } | null
  footer?: string | null
  buttons?: {
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'
    text: string
    url?: string
    phone_number?: string
    /** Full sample URL for URL buttons ending in {{1}}, or the sample coupon for COPY_CODE. */
    example?: string
  }[]
  variableLabels: string[]
  examples: string[]
}

/** Submits a text or media template to Meta for approval through AgencyX. Returns PENDING. */
export async function submitAgencyXTemplate(
  input: SubmitTemplateInput,
): Promise<{ success: boolean; status?: string; externalId?: string; error?: string }> {
  const { ok, status, data } = await call('POST', '/v1/templates', {
    name: input.name,
    language: input.language,
    category: input.category,
    body: input.body,
    ...(input.headerText ? { header_text: input.headerText } : {}),
    ...(input.header ? { header: input.header } : {}),
    ...(input.footer ? { footer: input.footer } : {}),
    ...(input.buttons?.length ? { buttons: input.buttons } : {}),
    variable_labels: input.variableLabels,
    examples: input.examples,
    ...(DEFAULT_FROM ? { from: DEFAULT_FROM } : {}),
  })
  if (!ok) return { success: false, error: errorOf(status, data) }
  return {
    success: true,
    status: String(data.status ?? 'PENDING'),
    externalId: (data.external_template_id as string) ?? undefined,
  }
}

/**
 * Edits a template that is APPROVED, REJECTED or PAUSED and sends it back for review.
 * All fields are optional — omitted ones keep their current value. Returns to PENDING.
 * Meta allows at most 10 edits per month and 1 per day on an APPROVED template.
 */
export async function editAgencyXTemplate(
  name: string,
  language: string,
  edits: Partial<Omit<SubmitTemplateInput, 'name' | 'language'>>,
): Promise<{ success: boolean; status?: string; error?: string }> {
  const { ok, status, data } = await call('POST', `/v1/templates/${encodeURIComponent(name)}/edit`, {
    language,
    ...(edits.category != null ? { category: edits.category } : {}),
    ...(edits.body != null ? { body: edits.body } : {}),
    ...(edits.headerText != null ? { header_text: edits.headerText } : {}),
    ...(edits.header != null ? { header: edits.header } : {}),
    ...(edits.footer != null ? { footer: edits.footer } : {}),
    ...(edits.buttons?.length ? { buttons: edits.buttons } : {}),
    ...(edits.variableLabels?.length ? { variable_labels: edits.variableLabels } : {}),
    ...(edits.examples?.length ? { examples: edits.examples } : {}),
    ...(DEFAULT_FROM ? { from: DEFAULT_FROM } : {}),
  })
  if (!ok) return { success: false, error: errorOf(status, data) }
  return { success: true, status: String(data.status ?? 'PENDING') }
}

/**
 * Deletes one language of a template at Meta and in AgencyX.
 * Meta keeps the name reserved for 30 days. Cannot delete a DISABLED template (409).
 */
export async function deleteAgencyXTemplate(
  name: string,
  language: string,
): Promise<{ success: boolean; error?: string }> {
  const qs = new URLSearchParams({ language })
  const { ok, status, data } = await call(
    'DELETE',
    `/v1/templates/${encodeURIComponent(name)}?${qs}`,
  )
  if (!ok) return { success: false, error: errorOf(status, data) }
  return { success: true }
}
