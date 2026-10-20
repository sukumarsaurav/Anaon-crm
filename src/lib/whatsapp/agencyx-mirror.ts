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

/**
 * The contact's opt-out state after this message, or null when it says nothing new.
 * AgencyX reports it on every received message (contact.opted_out), which also covers
 * a tapped "Stop promotions" button; the phrase match is the fallback for payloads
 * without it.
 */
function optChange(event: AgencyXMessageEvent): boolean | null {
  if (typeof event.contact?.opted_out === 'boolean') return event.contact.opted_out
  const t = (event.message?.text ?? '').trim().toLowerCase()
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
    .select('id, unread_count, last_message_at, lead_id, opted_out')
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
      const opted = optChange(event)
      // Only a change moves opted_out_at; every message carries the flag.
      if (opted !== null && opted !== Boolean(existing.opted_out)) {
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
  const opted = inbound ? optChange(event) : null

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

/**
 * Links a thread to its lead after the fact. The inbound webhook saves the message and
 * creates the lead at the same time (so the message shows up without waiting for lead
 * scoring/assignment), which means the thread is created before the lead id is known.
 * Same rule as upsertConversation: a lead someone linked by hand is never overwritten, and
 * the thread inherits the lead's owner and branch so it is visible to them.
 */
export async function attachLeadToConversation(rawWaId: string | null | undefined, leadId: string): Promise<void> {
  const waId = rawWaId?.replace(/\D/g, '')
  if (!waId) return
  const supabase = createServiceClient()
  const { data: conv } = await supabase
    .from('whatsapp_conversations').select('id, lead_id').eq('wa_id', waId).maybeSingle()
  if (!conv || conv.lead_id) return
  const { data: lead } = await supabase.from('leads').select('assigned_to, branch_id').eq('id', leadId).maybeSingle()
  const { error } = await supabase.from('whatsapp_conversations').update({
    lead_id: leadId,
    ...(lead?.assigned_to ? { assigned_to: lead.assigned_to } : {}),
    ...(lead?.branch_id ? { branch_id: lead.branch_id } : {}),
  }).eq('id', conv.id).is('lead_id', null)
  if (error) console.error('[agencyx] attaching lead to conversation failed', error)
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

/** Payload for whatsapp.template.status events. */
export interface AgencyXTemplateStatusEvent {
  template?: {
    name?: string | null
    language?: string | null
    status?: string | null
    rejected_reason?: string | null
    rejection_info?: { reason?: string | null; recommendation?: string | null } | null
  }
}

// Meta's statuses → wa_template_status. The enum has one slot for both PAUSED and
// DISABLED; rejection_reason says which.
export const META_TEMPLATE_STATUS: Record<string, string> = {
  APPROVED: 'approved',
  PENDING: 'pending_approval',
  IN_APPEAL: 'pending_approval',
  REJECTED: 'rejected',
  PAUSED: 'disabled',
  DISABLED: 'disabled',
}

/**
 * Applies Meta's review verdict to the CRM's template as it happens, instead of waiting
 * for someone to press Sync. A template the CRM doesn't have yet is left to the next
 * Sync, which imports it with its body and variables.
 */
export async function mirrorTemplateStatus(event: AgencyXTemplateStatusEvent): Promise<boolean> {
  const t = event.template
  const status = t?.status ? META_TEMPLATE_STATUS[t.status.toUpperCase()] : undefined
  if (!t?.name || !status) return true

  const supabase = createServiceClient()
  const { data: rows } = await supabase
    .from('whatsapp_templates')
    .select('id, language, status, is_active')
    .eq('name', t.name)
  // Exact language first; a CRM template saved as "en" also answers for "en_US".
  const lang = t.language ?? ''
  const row = rows?.find((r) => r.language === lang) ?? rows?.find((r) => r.language === lang.split('_')[0])
  if (!row) return true

  const info = t.rejection_info
  const reason = status === 'approved' || status === 'pending_approval' ? null
    : [info?.reason ?? t.rejected_reason, info?.recommendation].filter(Boolean).join(' — ')
      || (t.status === 'PAUSED' ? 'Paused by WhatsApp (quality)' : t.status === 'DISABLED' ? 'Disabled by WhatsApp' : null)

  const { error } = await supabase.from('whatsapp_templates').update({
    status,
    rejection_reason: reason,
    // Becoming approved switches it on; after that the Active toggle is the user's.
    is_active: status === 'approved' ? (row.status === 'approved' ? row.is_active : true) : false,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (error) {
    console.error('[agencyx] template status update failed', error)
    return false
  }
  return true
}
