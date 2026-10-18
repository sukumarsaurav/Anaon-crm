import { createServiceClient } from '@/lib/supabase/service'
import { sendTextMessage, sendTemplateMessage } from './provider'
import { agencyXConfigured, sendViaAgencyX, type AgencyXSendResult } from './agencyx-api'
import { toWhatsAppNumber } from './phone'

/**
 * The one way the CRM sends WhatsApp outside the inbox's reply box: automations, bulk
 * sends, broadcasts, OTP. AgencyX when AGENCYX_API_KEY is set (it owns the number), else
 * Meta's Cloud API directly with the WHATSAPP_* credentials.
 *
 * Plain module, not 'use server': it uses the service client and must never be callable
 * from the browser.
 */

export type WhatsAppProvider = 'agencyx' | 'meta'

export function activeWhatsAppProvider(): WhatsAppProvider | null {
  if (agencyXConfigured()) return 'agencyx'
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'meta'
  return null
}

export type SendResult = AgencyXSendResult & { to?: string }

const NOT_CONFIGURED: SendResult = {
  success: false,
  error: 'WhatsApp is not configured — set AGENCYX_API_KEY (or the WHATSAPP_* Meta credentials)',
}

export async function sendWhatsAppText(input: {
  to: string | null | undefined
  text: string
  reference?: string
}): Promise<SendResult> {
  const to = toWhatsAppNumber(input.to)
  if (!to) return { success: false, error: `Not a usable WhatsApp number: ${input.to ?? '(none)'}` }
  const provider = activeWhatsAppProvider()
  if (provider === 'agencyx') return { ...(await sendViaAgencyX({ to, text: input.text, reference: input.reference })), to }
  if (provider === 'meta') return { ...(await sendTextMessage(to, input.text)), to }
  return NOT_CONFIGURED
}

export async function sendWhatsAppTemplate(input: {
  to: string | null | undefined
  name: string
  language?: string | null
  /**
   * Named variables preferred: { "Customer name": "Ravi", "Clinic": "Dr Shah" }.
   * Positional array also accepted and forwarded as-is (for the Meta direct path).
   * Named form is used when the caller passes an object; array when they pass an array.
   */
  variables: Record<string, string> | string[]
  reference?: string
  /**
   * The template's category. Marketing sends ask AgencyX to refuse opted-out contacts
   * (respect_opt_out); utility and authentication sends (OTPs, payment reminders,
   * receipts) go regardless, as WhatsApp allows.
   */
  category?: string | null
}): Promise<SendResult> {
  const to = toWhatsAppNumber(input.to)
  if (!to) return { success: false, error: `Not a usable WhatsApp number: ${input.to ?? '(none)'}` }
  const provider = activeWhatsAppProvider()
  if (provider === 'agencyx') {
    const marketing = isMarketingCategory(input.category)
    return {
      ...(await sendViaAgencyX({
        to,
        template: {
          name: input.name,
          language: input.language ?? undefined,
          // Pass through as-is: named object or positional array are both accepted by the API.
          variables: input.variables,
        },
        reference: input.reference,
        respectOptOut: marketing,
        categoryHint: marketing ? 'marketing' : 'utility',
      })),
      to,
    }
  }
  if (provider === 'meta') {
    // Meta direct path requires positional array.
    const vars = Array.isArray(input.variables) ? input.variables : Object.values(input.variables)
    return { ...(await sendTemplateMessage(to, input.name, input.language ?? 'en', vars)), to }
  }
  return NOT_CONFIGURED
}

/**
 * Sends a file (image, video, audio, document) inside the 24-hour window via AgencyX.
 * Only available when AgencyX is configured — Meta direct path has no equivalent here.
 */
export async function sendWhatsAppMedia(input: {
  to: string | null | undefined
  type: 'image' | 'video' | 'audio' | 'document'
  url: string
  filename?: string
  caption?: string
  reference?: string
}): Promise<SendResult> {
  const to = toWhatsAppNumber(input.to)
  if (!to) return { success: false, error: `Not a usable WhatsApp number: ${input.to ?? '(none)'}` }
  if (!agencyXConfigured()) return { success: false, error: 'Media sends require AgencyX (AGENCYX_API_KEY)' }
  return {
    ...(await sendViaAgencyX({
      to,
      media: { type: input.type, url: input.url, filename: input.filename, caption: input.caption },
      reference: input.reference,
    })),
    to,
  }
}

/**
 * Only marketing is blocked by an opt-out; a STOP doesn't stop an OTP or a payment
 * reminder. Unknown (free text, a template without a category) counts as marketing.
 */
export function isMarketingCategory(category: string | null | undefined): boolean {
  const c = (category ?? '').toLowerCase()
  return c !== 'utility' && c !== 'authentication'
}

/**
 * True when the contact sent STOP (or similar). AgencyX also refuses marketing to them
 * when respect_opt_out is sent, but checking here first skips the call entirely — and
 * covers the Meta direct path, which has no such check.
 */
export async function isWhatsAppOptedOut(phone: string | null | undefined): Promise<boolean> {
  const waId = toWhatsAppNumber(phone)
  if (!waId) return false
  const { data } = await createServiceClient()
    .from('whatsapp_conversations')
    .select('opted_out')
    .eq('wa_id', waId)
    .maybeSingle()
  return Boolean(data?.opted_out)
}

/**
 * Puts a message the CRM sent into its WhatsApp inbox, attached to the contact's thread
 * (created if this is the first message). For AgencyX the `whatsapp.message.sent` echo
 * would add it too, but only as "[template] name"; this row has the rendered text and who
 * sent it, and the echo is dropped as a duplicate of its wa_message_id.
 */
export async function recordOutboundWhatsApp(input: {
  to: string
  body: string
  type: 'text' | 'template'
  waMessageId?: string | null
  templateName?: string | null
  templateParams?: Record<string, string> | null
  sentBy?: string | null
  broadcastId?: string | null
  leadId?: string | null
  isBot?: boolean
}): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const preview = input.type === 'template' ? `[Template] ${input.templateName ?? ''}`.trim() : input.body.slice(0, 100)

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id, lead_id')
    .eq('wa_id', input.to)
    .maybeSingle()

  let conversationId = existing?.id as string | undefined
  if (existing) {
    await supabase.from('whatsapp_conversations').update({
      last_message_at: now,
      last_message_preview: preview,
      updated_at: now,
      ...(!existing.lead_id && input.leadId ? { lead_id: input.leadId } : {}),
    }).eq('id', existing.id)
  } else {
    let assignedTo: string | null = null
    let branchId: string | null = null
    if (input.leadId) {
      const { data: lead } = await supabase.from('leads').select('assigned_to, branch_id').eq('id', input.leadId).maybeSingle()
      assignedTo = lead?.assigned_to ?? null
      branchId = lead?.branch_id ?? null
    }
    const { data: created, error } = await supabase.from('whatsapp_conversations').insert({
      wa_id: input.to,
      contact_phone: input.to,
      lead_id: input.leadId ?? null,
      assigned_to: assignedTo,
      branch_id: branchId,
      status: 'waiting_reply',
      unread_count: 0,
      last_message_at: now,
      last_message_preview: preview,
      is_bot_active: true,
      source: activeWhatsAppProvider() === 'agencyx' ? 'agencyx' : 'outbound',
    }).select('id').single()
    if (created) conversationId = created.id
    else if (error?.code === '23505') {
      const { data: raced } = await supabase.from('whatsapp_conversations').select('id').eq('wa_id', input.to).maybeSingle()
      conversationId = raced?.id
    }
  }
  if (!conversationId) return

  const row = {
    conversation_id: conversationId,
    wa_message_id: input.waMessageId ?? null,
    direction: 'outbound',
    type: input.type,
    body: input.body,
    template_name: input.templateName ?? null,
    template_params: input.templateParams ?? null,
    delivery_status: 'sent',
    sent_by: input.sentBy ?? null,
    broadcast_id: input.broadcastId ?? null,
    is_bot_message: input.isBot ?? false,
    created_at: now,
  }
  const { error } = row.wa_message_id
    ? await supabase.from('whatsapp_messages').upsert(row, { onConflict: 'wa_message_id' })
    : await supabase.from('whatsapp_messages').insert(row)
  if (error) console.error('[whatsapp] failed to record outbound message', error)
}
