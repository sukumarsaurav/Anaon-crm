'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { istToIso } from '@/lib/datetime'
import { getProfile } from '@/lib/supabase/getProfile'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTextMessage, sendTemplateMessage } from './provider'
import {
  agencyXConfigured,
  sendViaAgencyX,
  setAgencyXAutoReply,
  submitAgencyXTemplate,
  editAgencyXTemplate,
  deleteAgencyXTemplate,
  syncAgencyXTemplateStatuses,
} from './agencyx-api'
import { renderTemplate, namedVariables, toPositionalBody, sampleValueFor } from './template-render'
import { queueBroadcast, processBroadcast } from './broadcast'
import { isMarketingCategory } from './send'
import { META_TEMPLATE_STATUS } from './agencyx-mirror'
import { toWhatsAppNumber } from './phone'
import { getTemplateById } from './queries'
import { validateTemplateButtons, normalizeTemplateButtons } from './template-buttons'
import type { WaTemplateButton } from '@/types/whatsapp'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Records a message the agent sent. Upsert on wa_message_id: for an AgencyX chat,
 * AgencyX's `whatsapp.message.sent` echo of this same message can land first (as a row
 * without sent_by); this row, which knows who sent it, replaces it.
 */
function usesAgencyX(source: string | null | undefined): boolean {
  return source === 'agencyx' || agencyXConfigured()
}

async function requireManager() {
  const session = await getProfile()
  if (!session?.user) return { ok: false as const, error: 'Unauthorized' }
  if (!['admin', 'manager'].includes(session.profile?.role ?? '')) {
    return { ok: false as const, error: 'Only admins and managers can do this' }
  }
  return { ok: true as const, user: session.user }
}

async function saveOutbound(supabase: ServerClient, row: Record<string, unknown>) {
  const { error } = row.wa_message_id
    ? await supabase.from('whatsapp_messages').upsert(row, { onConflict: 'wa_message_id' })
    : await supabase.from('whatsapp_messages').insert(row)
  if (error) console.error('[whatsapp] failed to record sent message', error)
}

export async function sendMessage(conversationId: string, text: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!text.trim()) return { success: false, error: 'Message is empty' }

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('contact_phone, opted_out, source, waba_phone_number_id')
    .eq('id', conversationId)
    .single()

  if (!conv) return { success: false, error: 'Conversation not found' }
  // No opt-out check: free text only reaches someone who messaged in the last 24 hours,
  // so this is answering them, not marketing to them. A STOP blocks marketing only.

  // With AgencyX connected it owns the number, so every thread replies through it — not
  // only threads it created. Replying also pauses its bot on this chat (pauseAutoReply):
  // a person has taken over.
  const viaAgencyX = usesAgencyX(conv.source)
  const to = toWhatsAppNumber(conv.contact_phone) ?? conv.contact_phone
  const result = viaAgencyX
    ? await sendViaAgencyX({ to, from: conv.waba_phone_number_id, text, pauseAutoReply: true })
    : await sendTextMessage(to, text)

  if (!result.success) return { success: false, error: result.error }

  await saveOutbound(supabase, {
    conversation_id: conversationId,
    wa_message_id: result.messageId ?? null,
    direction: 'outbound',
    type: 'text',
    body: text,
    delivery_status: 'sent',
    sent_by: user.id,
    is_bot_message: false,
  })

  await supabase.from('whatsapp_conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 100),
    status: 'in_progress',
    updated_at: new Date().toISOString(),
    // Keeps the header's Bot ON/OFF truthful: AgencyX's bot is now off for this chat.
    ...(viaAgencyX ? { is_bot_active: false, bot_handoff_at: new Date().toISOString() } : {}),
  }).eq('id', conversationId)

  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function sendTemplateToConversation(
  conversationId: string,
  templateId: string,
  variableValues: Record<string, string>
) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const [conv, template] = await Promise.all([
    supabase.from('whatsapp_conversations').select('contact_phone, opted_out, source, waba_phone_number_id').eq('id', conversationId).single(),
    getTemplateById(templateId),
  ])

  if (!conv.data) return { success: false, error: 'Conversation not found' }
  if (!template) return { success: false, error: 'Template not found' }
  const marketing = isMarketingCategory(template.category)
  if (conv.data.opted_out && marketing) {
    return { success: false, error: 'Contact has opted out of WhatsApp marketing — only utility templates can be sent' }
  }

  if (template.status !== 'approved') return { success: false, error: 'This template is not approved by WhatsApp yet' }
  const variables = template.variable_names.map((name) => (variableValues[name] ?? '').trim())
  const empty = template.variable_names.filter((_, i) => !variables[i])
  if (empty.length) return { success: false, error: `Fill in: ${empty.join(', ')}` }

  const viaAgencyX = usesAgencyX(conv.data.source)
  const to = toWhatsAppNumber(conv.data.contact_phone) ?? conv.data.contact_phone
  const result = viaAgencyX
    ? await sendViaAgencyX({
        to,
        from: conv.data.waba_phone_number_id,
        template: { name: template.name, language: template.language, variables },
        pauseAutoReply: true,
        respectOptOut: marketing,
        categoryHint: marketing ? 'marketing' : 'utility',
      })
    : await sendTemplateMessage(to, template.name, template.language, variables)

  if (!result.success) return { success: false, error: result.error }

  const renderedBody = renderTemplate(template.body, template.variable_names, variableValues)

  await saveOutbound(supabase, {
    conversation_id: conversationId,
    wa_message_id: result.messageId ?? null,
    direction: 'outbound',
    type: 'template',
    body: renderedBody,
    template_name: template.name,
    template_params: Object.fromEntries(template.variable_names.map((n) => [n, variableValues[n] ?? ''])),
    delivery_status: 'sent',
    sent_by: user.id,
    is_bot_message: false,
  })

  await supabase.from('whatsapp_conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: `[Template] ${template.display_name}`,
    updated_at: new Date().toISOString(),
    ...(viaAgencyX ? { is_bot_active: false, bot_handoff_at: new Date().toISOString() } : {}),
  }).eq('id', conversationId)

  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function assignConversation(conversationId: string, advisorId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('whatsapp_conversations').update({
    assigned_to: advisorId,
    status: 'assigned',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/whatsapp/inbox')
  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function resolveConversation(conversationId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('whatsapp_conversations').update({
    status: 'resolved',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/whatsapp/inbox')
  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient()
  await supabase.from('whatsapp_conversations').update({
    unread_count: 0,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)
  revalidatePath('/whatsapp/inbox')
}

export async function takeBotControl(conversationId: string, enableBot: boolean) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  // On an AgencyX chat the bot that answers is AgencyX's, so the switch is applied there
  // first; the CRM's flag only follows once AgencyX has accepted it.
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('contact_phone, source, waba_phone_number_id')
    .eq('id', conversationId)
    .single()
  if (conv && usesAgencyX(conv.source)) {
    const res = await setAgencyXAutoReply(toWhatsAppNumber(conv.contact_phone) ?? conv.contact_phone, enableBot, conv.waba_phone_number_id)
    if (!res.success) return { success: false, error: res.error }
  }

  const updates: Record<string, unknown> = {
    is_bot_active: enableBot,
    updated_at: new Date().toISOString(),
  }
  if (!enableBot) {
    updates.bot_handoff_at = new Date().toISOString()
  }

  const { error } = await supabase.from('whatsapp_conversations').update(updates).eq('id', conversationId)
  if (error) return { success: false, error: error.message }

  if (!enableBot) {
    await supabase.from('chatbot_sessions')
      .update({ is_active: false, handed_off: true, handoff_reason: 'manual', updated_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
  }

  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

interface TemplateInput {
  name: string
  display_name: string
  category: string
  language: string
  header_text: string | null
  body: string
  footer: string | null
  buttons: WaTemplateButton[]
}

function readTemplateForm(formData: FormData): TemplateInput | { error: string } {
  const name = String(formData.get('name') ?? '').trim().toLowerCase()
  const body = String(formData.get('body') ?? '').trim()
  if (!/^[a-z0-9_]{1,512}$/.test(name)) return { error: 'Template name: lowercase letters, digits and _ only' }
  if (!body) return { error: 'Message body is required' }
  if (body.length > 1024) return { error: 'Message body is limited to 1024 characters' }
  const header = String(formData.get('header_text') ?? '').trim() || null
  if (header && (header.length > 60 || header.includes('{{'))) return { error: 'Header: up to 60 characters, no variables' }
  const footer = String(formData.get('footer') ?? '').trim() || null
  if (footer && footer.length > 60) return { error: 'Footer is limited to 60 characters' }
  let buttons: WaTemplateButton[]
  try {
    buttons = JSON.parse(String(formData.get('buttons') ?? '[]'))
    if (!Array.isArray(buttons)) throw new Error()
  } catch {
    return { error: 'Invalid buttons' }
  }
  const buttonError = validateTemplateButtons(buttons)
  if (buttonError) return { error: buttonError }
  return {
    name,
    display_name: String(formData.get('display_name') ?? '').trim() || name,
    category: String(formData.get('category') ?? 'marketing'),
    language: String(formData.get('language') ?? 'en') || 'en',
    header_text: header,
    body,
    footer,
    buttons: normalizeTemplateButtons(buttons),
  }
}

export async function createTemplate(formData: FormData) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const input = readTemplateForm(formData)
  if ('error' in input) return { success: false, error: input.error }

  const supabase = await createClient()
  const variableNames = namedVariables(input.body)
  const { data: created, error } = await supabase.from('whatsapp_templates').insert({
    name: input.name,
    display_name: input.display_name,
    category: input.category,
    language: input.language,
    status: 'draft',
    header_type: input.header_text ? 'text' : null,
    header_content: input.header_text,
    body: input.body,
    footer: input.footer,
    buttons: input.buttons,
    variable_names: variableNames,
    is_active: false,
    created_by: auth.user.id,
  }).select('id').single()

  if (error?.code === '23505') return { success: false, error: 'A template with that name already exists in ' + input.language + '. WhatsApp allows one per name and language - pick another name.' }
  if (error || !created) return { success: false, error: error?.message ?? 'Could not save the template' }

  if (formData.get('submit_for_approval') === 'true') {
    const examples = Object.fromEntries(variableNames.map((v) => [v, String(formData.get(`example_${v}`) ?? '')]))
    const submitted = await submitTemplateForApproval(created.id, examples)
    revalidatePath('/whatsapp/templates')
    if (!submitted.success) {
      return { success: true, id: created.id, warning: `Saved as draft, but submission failed: ${submitted.error}` }
    }
  }
  revalidatePath('/whatsapp/templates')
  return { success: true, id: created.id }
}

export async function updateTemplate(id: string, formData: FormData) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const supabase = await createClient()

  const { data: current } = await supabase.from('whatsapp_templates').select('status').eq('id', id).single()
  // What WhatsApp approved is what it will send; editing the CRM's copy of an approved or
  // pending template would only make the preview lie. Create a new template instead.
  if (current && !['draft', 'rejected'].includes(current.status)) {
    return { success: false, error: 'Only draft or rejected templates can be edited — create a new one instead' }
  }

  const body = formData.get('body') as string
  const { error } = await supabase.from('whatsapp_templates').update({
    display_name: formData.get('display_name') as string,
    body,
    footer: formData.get('footer') as string || null,
    variable_names: namedVariables(body),
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/templates')
  return { success: true }
}

/**
 * Sends a CRM template to Meta for approval through AgencyX. `examples` are the sample
 * values Meta's reviewers see, by variable name; missing ones get a believable default.
 */
export async function submitTemplateForApproval(id: string, examples: Record<string, string> = {}) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!agencyXConfigured()) {
    return { success: false, error: 'Connect AgencyX first (AGENCYX_API_KEY) — templates are submitted to WhatsApp through it' }
  }

  const supabase = await createClient()
  const { data: t } = await supabase.from('whatsapp_templates').select('*').eq('id', id).single()
  if (!t) return { success: false, error: 'Template not found' }
  if (!['draft', 'rejected'].includes(t.status)) return { success: false, error: `This template is already ${t.status.replace('_', ' ')}` }
  if (t.category === 'authentication') {
    return { success: false, error: 'Authentication (OTP) templates have a fixed format — create them in the AgencyX dashboard' }
  }

  const names = (t.variable_names as string[]) ?? []
  const result = await submitAgencyXTemplate({
    name: t.name,
    language: t.language,
    category: t.category === 'utility' ? 'UTILITY' : 'MARKETING',
    body: toPositionalBody(t.body, names),
    headerText: t.header_type === 'text' ? t.header_content : null,
    footer: t.footer,
    buttons: (t.buttons as WaTemplateButton[] | null) ?? [],
    variableLabels: names,
    examples: names.map((n) => examples[n]?.trim() || sampleValueFor(n)),
  })
  if (!result.success) return { success: false, error: result.error }

  await supabase.from('whatsapp_templates').update({
    status: result.status === 'APPROVED' ? 'approved' : 'pending_approval',
    is_active: result.status === 'APPROVED',
    meta_template_id: result.externalId ?? null,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/whatsapp/templates')
  return { success: true, status: result.status }
}

/**
 * Pulls every template's review state from WhatsApp (via AgencyX) into the CRM, and adds
 * templates that were created in AgencyX directly. A CRM template marked approved that
 * WhatsApp doesn't have can't be sent, so it goes back to draft.
 */
export async function syncTemplateStatuses() {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const res = await syncAgencyXTemplateStatuses()
  if (!res.success) return { success: false, error: res.error }

  const supabase = createServiceClient()
  const { data: local } = await supabase.from('whatsapp_templates').select('id, name, language, status, is_active')
  const key = (n: string, l: string) => `${n}\u0000${l}`
  const byKey = new Map<string, NonNullable<typeof local>[number]>()
  for (const t of local ?? []) {
    // Prefer the row already approved/pending when the CRM has duplicates.
    const k = key(t.name, t.language)
    if (!byKey.has(k) || t.status !== 'draft') byKey.set(k, t)
  }

  let updated = 0
  let added = 0
  const remote = new Set<string>()
  for (const r of res.templates ?? []) {
    const status = META_TEMPLATE_STATUS[r.status] ?? 'pending_approval'
    // A CRM template saved as "en" is the same as Meta's "en" only; match exactly, then
    // fall back to the base language so "en" finds "en_US".
    const existing = byKey.get(key(r.name, r.language)) ?? byKey.get(key(r.name, r.language.split('_')[0]))
    remote.add(existing ? existing.id : key(r.name, r.language))
    if (existing) {
      await supabase.from('whatsapp_templates').update({
        status,
        rejection_reason: r.rejected_reason ?? null,
        language: r.language,
        // What WhatsApp holds is what it sends: keep buttons and footer in step with it.
        // The body stays the CRM's (it names its variables; Meta's is positional).
        ...(r.buttons?.length ? { buttons: r.buttons } : {}),
        ...(r.footer ? { footer: r.footer } : {}),
        // Becoming approved switches it on; after that the Active toggle is the user's.
        is_active: status === 'approved' ? (existing.status === 'approved' ? existing.is_active : true) : false,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      updated++
    } else {
      const names = r.variables ?? []
      await supabase.from('whatsapp_templates').insert({
        name: r.name,
        display_name: r.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        category: (r.category ?? 'MARKETING').toLowerCase() === 'utility' ? 'utility'
          : (r.category ?? '').toLowerCase() === 'authentication' ? 'authentication' : 'marketing',
        language: r.language,
        status,
        rejection_reason: r.rejected_reason ?? null,
        body: r.body ?? `[${r.name}]`,
        variable_names: names,
        header_type: r.header === 'none' ? null : r.header,
        header_content: r.header === 'text' ? r.header_text : r.header_media_url,
        footer: r.footer,
        buttons: r.buttons ?? [],
        is_active: status === 'approved',
        created_by: auth.user.id,
      })
      added++
    }
  }

  // Marked approved in the CRM but unknown to WhatsApp — sending would only fail.
  const orphans = (local ?? []).filter((t) => t.status === 'approved' && !remote.has(t.id))
  if (orphans.length) {
    await supabase.from('whatsapp_templates').update({
      status: 'draft',
      is_active: false,
      rejection_reason: 'Not found on the WhatsApp number — submit it for approval',
      updated_at: new Date().toISOString(),
    }).in('id', orphans.map((t) => t.id))
  }

  revalidatePath('/whatsapp/templates')
  return { success: true, updated, added, resetToDraft: orphans.length }
}

export async function toggleTemplateActive(id: string, isActive: boolean) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const supabase = await createClient()
  const { error } = await supabase.from('whatsapp_templates').update({
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/templates')
  return { success: true }
}

export async function createBroadcast(formData: FormData) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const supabase = await createClient()

  let audienceFilters: Record<string, unknown> = {}
  try {
    audienceFilters = JSON.parse((formData.get('audience_filters') as string) || '{}')
  } catch {
    return { success: false, error: 'Invalid audience filters' }
  }
  const scheduledAt = istToIso(formData.get('scheduled_at') as string)
  if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) return { success: false, error: 'Invalid schedule time' }

  const { data, error } = await supabase.from('whatsapp_broadcasts').insert({
    name: formData.get('name') as string,
    template_id: formData.get('template_id') as string,
    audience_filters: audienceFilters,
    audience_count: 0,
    scheduled_at: scheduledAt,
    // A scheduled broadcast is started by the cron (/api/cron/broadcasts) once due.
    status: scheduledAt ? 'scheduled' : 'draft',
    total_sent: 0,
    total_delivered: 0,
    total_read: 0,
    total_replied: 0,
    total_failed: 0,
    created_by: auth.user.id,
  }).select('id').single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create' }
  revalidatePath('/whatsapp/broadcasts')
  return { success: true, id: data.id }
}

/** Starts a draft/scheduled broadcast now and sends the first batch. */
export async function sendBroadcast(broadcastId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }

  const queued = await queueBroadcast(broadcastId)
  if (!queued.success) return { success: false, error: queued.error }
  const run = await processBroadcast(broadcastId)

  revalidatePath('/whatsapp/broadcasts')
  revalidatePath(`/whatsapp/broadcasts/${broadcastId}`)
  return { success: true, totalSent: run.sent, totalFailed: run.failed, remaining: run.remaining, rateLimited: run.rateLimited, skipped: queued.skipped }
}

/** Sends the next batch of a broadcast that is still going (time limit or rate limit hit). */
export async function resumeBroadcast(broadcastId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const run = await processBroadcast(broadcastId)
  revalidatePath('/whatsapp/broadcasts')
  revalidatePath(`/whatsapp/broadcasts/${broadcastId}`)
  return { success: true, ...run }
}

export async function cancelBroadcast(broadcastId: string) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const supabase = createServiceClient()
  await supabase.from('whatsapp_broadcast_recipients')
    .update({ status: 'failed', failed_reason: 'Broadcast cancelled' })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'queued')
  await supabase.from('whatsapp_broadcasts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', broadcastId)
    .in('status', ['draft', 'scheduled', 'sending'])
  revalidatePath('/whatsapp/broadcasts')
  revalidatePath(`/whatsapp/broadcasts/${broadcastId}`)
  return { success: true }
}

export async function saveAutoReplyRule(formData: FormData) {
  // Only managers/admins change automatic replies. (It only checked for a session, so any
  // signed-in user could — the database policy now blocks it, but with a raw error.)
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  const supabase = await createClient()

  // `formData.get(x) as string ?? '{}'` never applied the default (get() returns null, not
  // undefined) and an invalid value threw an unhandled error.
  const parse = (key: string, fallback: unknown) => {
    const raw = formData.get(key)
    if (typeof raw !== 'string' || !raw.trim()) return fallback
    return JSON.parse(raw)
  }

  const id = formData.get('id') as string | null
  let payload
  try {
    payload = {
      name: formData.get('name') as string,
      is_active: formData.get('is_active') === 'true',
      priority: parseInt(formData.get('priority') as string, 10) || 10,
      trigger_type: formData.get('trigger_type') as string,
      trigger_config: parse('trigger_config', {}),
      response_type: formData.get('response_type') as string,
      response_text: formData.get('response_text') as string || null,
      response_template_id: formData.get('response_template_id') as string || null,
      response_buttons: parse('response_buttons', []),
    }
  } catch {
    return { success: false, error: 'Trigger or button settings are not valid JSON' }
  }

  let error
  if (id) {
    ;({ error } = await supabase.from('auto_reply_rules').update(payload).eq('id', id))
  } else {
    ;({ error } = await supabase.from('auto_reply_rules').insert(payload))
  }

  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/auto-reply')
  return { success: true }
}

/**
 * Fixes a rejected template and sends it back to Meta for review via AgencyX's edit
 * endpoint. Meta refuses a second create under an existing name — editing is the only
 * path for a rejected template. Returns to PENDING after this call.
 */
export async function resubmitRejectedTemplate(id: string, formData: FormData) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!agencyXConfigured()) {
    return { success: false, error: 'Connect AgencyX first (AGENCYX_API_KEY)' }
  }

  const supabase = await createClient()
  const { data: t } = await supabase.from('whatsapp_templates').select('*').eq('id', id).single()
  if (!t) return { success: false, error: 'Template not found' }
  if (!['rejected', 'disabled'].includes(t.status)) {
    return { success: false, error: 'Only rejected or disabled templates can be re-edited this way' }
  }

  const rawBody = formData.get('body') as string | null
  const body = rawBody?.trim() || (t.body as string)
  const names = namedVariables(body)
  const examples = names.map((n) =>
    String(formData.get(`example_${n}`) ?? '').trim() || sampleValueFor(n)
  )

  const result = await editAgencyXTemplate(t.name as string, t.language as string, {
    body: toPositionalBody(body, names),
    variableLabels: names,
    examples,
    ...(formData.get('header_text') != null
      ? { headerText: (formData.get('header_text') as string).trim() || null }
      : {}),
    ...(formData.get('footer') != null
      ? { footer: (formData.get('footer') as string).trim() || null }
      : {}),
  })
  if (!result.success) return { success: false, error: result.error }

  await supabase.from('whatsapp_templates').update({
    body,
    variable_names: names,
    status: 'pending_approval',
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/whatsapp/templates')
  return { success: true }
}

/**
 * Deletes a template from Meta (via AgencyX) and from the CRM.
 * Meta keeps the name reserved for 30 days; cannot delete a DISABLED template.
 */
export async function deleteTemplate(id: string) {
  const auth = await requireManager()
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: t } = await supabase
    .from('whatsapp_templates')
    .select('name, language, status')
    .eq('id', id)
    .single()
  if (!t) return { success: false, error: 'Template not found' }

  if (t.status === 'disabled') {
    return {
      success: false,
      error: 'WhatsApp does not allow deleting a disabled template. Contact AgencyX support.',
    }
  }

  // Everything but a local draft exists at Meta — rejected ones included, and they'd
  // linger in WhatsApp Manager. Already gone there (404) is fine.
  if (t.status !== 'draft' && agencyXConfigured()) {
    const result = await deleteAgencyXTemplate(t.name as string, t.language as string)
    if (!result.success && !result.notFound) return { success: false, error: result.error }
  }

  await supabase.from('whatsapp_templates').delete().eq('id', id)
  revalidatePath('/whatsapp/templates')
  return { success: true }
}
