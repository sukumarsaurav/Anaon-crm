import { createServiceClient } from '@/lib/supabase/service'
import { applyBroadcastReceipt, markBroadcastReplied } from './broadcast'

/**
 * Mirrors WhatsApp traffic from AgencyX into the CRM's own WhatsApp inbox
 * (whatsapp_conversations / whatsapp_messages), so the chats a team sees in AgencyX
 * are the same chats sales sees here, attached to the lead.
 *
 * AgencyX owns the number: it receives from Meta, runs the bot and auto-replies, and
 * sends. This side only records; it never runs the CRM's own chatbot or auto-reply rules
 * on these messages (that would answer every customer twice). Agents reply from the CRM
 * through AgencyX's send API — see agencyx-api.ts.
 *
 * AgencyX retries a delivery until it gets a 2xx, so every write here is idempotent:
 * conversations are keyed by wa_id and messages by wa_message_id, both UNIQUE.
 */

// Payload shapes from AgencyX's webhook docs (whatsapp.message.received / .sent / .status).
export interface AgencyXMessageEvent {
  channel?: { phone_number_id?: string | null }
  contact?: {
    wa_id?: string | null
    phone?: string | null
    name?: string | null
    /** received events only: true when the contact is opted out after this message. */
    opted_out?: boolean
  }
  message?: {
    id?: string | null
    type?: string
    text?: string | null
    timestamp?: string | null
    media?: { url?: string; mime_type?: string | null; filename?: string | null } | null
    /** sent events, source=api: the client_reference the CRM sent with. */
    client_reference?: string | null
    /** sent events, source=broadcast: AgencyX campaign id. */
    campaign_id?: string | null
  }
  // .sent only: who sent it from AgencyX.
  source?: 'agent' | 'bot' | 'rule' | 'api' | 'broadcast' | 'business_app'
}

export interface AgencyXStatusEvent {
  message?: {
    id?: string | null
    status?: 'sent' | 'delivered' | 'read' | 'failed'
    timestamp?: string | null
    errors?: { title?: string; message?: string }[] | null
    /** Set for messages sent via the Send API — matches the CRM's own record. */
    client_reference?: string | null
  }
}

/** Payload for whatsapp.contact.opt_out events. */
export interface AgencyXOptOutEvent {
  contact?: { wa_id?: string | null; phone?: string | null; name?: string | null }
  opted_out?: boolean
  at?: string | null
}

// AgencyX's types → the CRM's wa_message_type enum. Types the enum has no slot for
// (contacts, order, unknown) are stored as text; the body still says what they were.
const TYPE_MAP: Record<string, string> = {
  text: 'text',
  image: 'image',
  document: 'document',
  audio: 'audio',
  video: 'video',
  sticker: 'sticker',
  location: 'location',
  reaction: 'reaction',
  system: 'system',
  interactive: 'button_reply',
  button: 'button_reply',
  template: 'template',
}

// Receipts can arrive out of order ('read' before 'delivered'), so each status may only
// replace the ones before it. 'failed' never replaces 'read' — a read message was, by
// definition, delivered. Same rule AgencyX applies to its own inbox.
const REPLACEABLE_BY: Record<string, string[]> = {
  sent: ['queued'],
  delivered: ['queued', 'sent'],
  read: ['queued', 'sent', 'delivered'],
  failed: ['queued', 'sent', 'delivered'],
}

// AgencyX records opt-outs on its side and also fires whatsapp.contact.opt_out events.
// The CRM keeps its own flag (checked before every marketing send) so it stays correct
// even if an opt_out event is received before the corresponding received message.
// Same phrases AgencyX's webhook server uses for STOP/START detection.
const OPT_OUT = new Set(['stop', 'unsubscribe', 'stop promotions', 'stop all', 'opt out', 'optout', 'cancel subscription'])
const OPT_IN = new Set(['start', 'subscribe', 'unstop', 'resume promotions'])

function optChange(text: string | null | undefined): boolean | null {
  const t = (text ?? '').trim().toLowerCase()
  if (OPT_OUT.has(t)) return true
  if (OPT_IN.has(t)) return false
  return null
}

function preview(type: string, text: string | null | undefined): string {
  return (text || `[${type}]`).slice(0, 100)
}

/**
 * Finds or creates the thread for this contact. `leadId` is attached only if the thread
 * has none yet, so a lead someone linked by hand is never overwritten.
 */
async function upsertConversation(
  event: AgencyXMessageEvent,
  waId: string,
  atIso: string,
  inbound: boolean,
  leadId: string | null,
): Promise<string | null> {
  const supabase = createServiceClient()
  const type = event.message?.type ?? 'text'
  const snippet = preview(type, event.message?.text)

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id, unread_count, last_message_at, lead_id')
    .eq('wa_id', waId)
    .maybeSingle()

  if (existing) {
    const newer = !existing.last_message_at || new Date(existing.last_message_at) <= new Date(atIso)
    const update: Record<string, unknown> = {}
    if (newer) {
      update.last_message_at = atIso
      update.last_message_preview = snippet
    }
    if (inbound) {
      update.unread_count = (existing.unread_count ?? 0) + 1
      update.status = 'in_progress'
      if (event.contact?.name) update.contact_name = event.contact.name
      const opted = optChange(event.message?.text)
      if (opted !== null) {
        update.opted_out = opted
        update.opted_out_at = opted ? atIso : null
      }
    }
    if (!existing.lead_id && leadId) {
      update.lead_id = leadId
      const { data: lead } = await supabase.from('leads').select('assigned_to, branch_id').eq('id', leadId).maybeSingle()
      if (lead?.assigned_to) update.assigned_to = lead.assigned_to
      if (lead?.branch_id) update.branch_id = lead.branch_id
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('whatsapp_conversations').update(update).eq('id', existing.id)
    }
    return existing.id
  }

  // Inbox visibility is scoped by assigned_to (advisors) and branch_id (managers), so a
  // thread with neither is invisible to everyone but admins. Inherit them from the lead.
  let assignedTo: string | null = null
  let branchId: string | null = null
  if (leadId) {
    const { data: lead } = await supabase.from('leads').select('assigned_to, branch_id').eq('id', leadId).maybeSingle()
    assignedTo = lead?.assigned_to ?? null
    branchId = lead?.branch_id ?? null
  }
  const opted = inbound ? optChange(event.message?.text) : null

  const { data: created, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      assigned_to: assignedTo,
      branch_id: branchId,
      opted_out: opted === true,
      opted_out_at: opted === true ? atIso : null,
      wa_id: waId,
      contact_phone: waId,
      contact_name: event.contact?.name ?? null,
      lead_id: leadId,
      status: 'new',
      unread_count: inbound ? 1 : 0,
      last_message_at: atIso,
      last_message_preview: snippet,
      // On these threads the flag mirrors AgencyX's bot (on by default for a new chat),
      // and the header's Bot ON/OFF switch drives it through AgencyX's API. The CRM's own
      // chatbot never runs on them — this route doesn't call it.
      is_bot_active: true,
      source: 'agencyx',
      waba_phone_number_id: event.channel?.phone_number_id ?? null,
    })
    .select('id')
    .single()

  if (created) return created.id
  // 23505: a concurrent delivery for the same contact created it first.
  if (error?.code === '23505') {
    const { data: raced } = await supabase.from('whatsapp_conversations').select('id').eq('wa_id', waId).maybeSingle()
    return raced?.id ?? null
  }
  console.error('[agencyx] conversation insert failed', error)
  return null
}

/**
 * Stores one message. Returns false only for failures a retry could fix, so the route
 * can answer 500 and let AgencyX try again.
 */
export async function mirrorMessage(
  event: AgencyXMessageEvent,
  direction: 'inbound' | 'outbound',
  leadId: string | null,
): Promise<boolean> {
  const waId = event.contact?.wa_id?.replace(/\D/g, '')
  if (!waId) return true // nothing to attach it to; retrying won't change that

  const atIso = event.message?.timestamp ? new Date(event.message.timestamp).toISOString() : new Date().toISOString()

  // AgencyX delivers at least once. A redelivery must not count as another unread
  // message or re-run the opt-out/reply bookkeeping.
  if (event.message?.id) {
    const { data: seen } = await createServiceClient()
      .from('whatsapp_messages').select('id').eq('wa_message_id', event.message.id).maybeSingle()
    if (seen) return true
  }

  const conversationId = await upsertConversation(event, waId, atIso, direction === 'inbound', leadId)
  if (!conversationId) return false

  const rawType = event.message?.type ?? 'text'
  const row = {
    conversation_id: conversationId,
    wa_message_id: event.message?.id ?? null,
    direction,
    type: TYPE_MAP[rawType] ?? 'text',
    body: event.message?.text || null,
    // AgencyX's media link is signed and expires (7 days); good enough to open from a
    // recent chat, and the AgencyX inbox keeps the original.
    media_url: event.message?.media?.url ?? null,
    media_mime_type: event.message?.media?.mime_type ?? null,
    media_filename: event.message?.media?.filename ?? null,
    delivery_status: direction === 'inbound' ? 'delivered' : 'sent',
    delivered_at: direction === 'inbound' ? atIso : null,
    is_bot_message: event.source === 'bot' || event.source === 'rule',
    created_at: atIso,
  }

  const supabase = createServiceClient()
  // A sent message whose id Meta didn't return can't be deduplicated; store it once.
  const { error } = row.wa_message_id
    ? await supabase.from('whatsapp_messages').upsert(row, { onConflict: 'wa_message_id', ignoreDuplicates: true })
    : await supabase.from('whatsapp_messages').insert(row)

  if (error) {
    console.error('[agencyx] message insert failed', error)
    return false
  }
  if (direction === 'inbound') await markBroadcastReplied(waId)
  return true
}

export async function mirrorStatus(event: AgencyXStatusEvent): Promise<boolean> {
  const id = event.message?.id
  const status = event.message?.status
  if (!id || !status || !REPLACEABLE_BY[status]) return true

  const supabase = createServiceClient()
  const { data: current } = await supabase
    .from('whatsapp_messages')
    .select('id, delivery_status')
    .eq('wa_message_id', id)
    .maybeSingle()

  const at = event.message?.timestamp ? new Date(event.message.timestamp).toISOString() : new Date().toISOString()
  // The receipt can beat the .sent event here. The inbox row is skipped (the next receipt
  // usually brings it up to date), but a broadcast recipient is already keyed by the
  // wamid AgencyX returned, so its counts are updated regardless.
  if (!current) {
    await applyBroadcastReceipt(id, status, at, event.message?.errors?.[0]?.title ?? event.message?.errors?.[0]?.message)
    return true
  }
  if (!REPLACEABLE_BY[status].includes(current.delivery_status ?? 'queued')) return true

  const update: Record<string, unknown> = { delivery_status: status }
  if (status === 'delivered') update.delivered_at = at
  if (status === 'read') update.read_at = at
  if (status === 'failed') update.failed_reason = event.message?.errors?.[0]?.title ?? event.message?.errors?.[0]?.message ?? 'Failed'

  const { error } = await supabase.from('whatsapp_messages').update(update).eq('id', current.id)
  if (error) {
    console.error('[agencyx] status update failed', error)
    return false
  }
  await applyBroadcastReceipt(id, status, at, update.failed_reason as string | undefined)
  return true
}

/**
 * Mirrors a whatsapp.contact.opt_out event into the CRM's conversations table.
 * AgencyX fires this when a customer replies STOP (opted_out: true) or START (false).
 * A START can arrive for a contact who was never opted out — that's fine, just sets the flag.
 */
export async function mirrorOptOut(event: AgencyXOptOutEvent): Promise<boolean> {
  const waId = event.contact?.wa_id?.replace(/\D/g, '')
  if (!waId) return true // no id to match on; retrying won't help

  const optedOut = Boolean(event.opted_out)
  const at = event.at ? new Date(event.at).toISOString() : new Date().toISOString()

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({
      opted_out: optedOut,
      opted_out_at: optedOut ? at : null,
      ...(event.contact?.name ? { contact_name: event.contact.name } : {}),
    })
    .eq('wa_id', waId)

  if (error) {
    console.error('[agencyx] opt-out update failed', error)
    return false
  }
  return true
}
