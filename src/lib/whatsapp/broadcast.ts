import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsAppTemplate, recordOutboundWhatsApp } from './send'
import { fillTemplateVariables } from './variables'
import { renderTemplate } from './template-render'
import { toWhatsAppNumber } from './phone'

/**
 * Broadcast engine. Plain module (service client) — reached only through the role-checked
 * server actions in actions.ts and the cron route.
 *
 * Two steps, so a big audience survives function timeouts and AgencyX's per-key rate
 * limit (120/min by default):
 *   1. queueBroadcast   — resolve the audience once into whatsapp_broadcast_recipients
 *                         rows ('queued'), with opt-outs and unfillable rows settled.
 *   2. processBroadcast — send queued rows for up to `budgetMs`, stop early on a 429,
 *                         and leave the rest queued for the next run (Resume button, or
 *                         the daily cron).
 * Each send uses the recipient row id as AgencyX's client_reference, so re-running a
 * batch can never message the same person twice.
 */

export interface BroadcastAudienceFilters {
  stage?: string[]
  source?: string[]
  project_id?: string
  city?: string
  budget_min?: number
  budget_max?: number
  /** Fixed values for template variables the lead record can't fill (e.g. an offer). */
  variables?: Record<string, string>
}

const SENT_STATES = ['sent', 'delivered', 'read']

export async function queueBroadcast(broadcastId: string): Promise<{ success: boolean; error?: string; queued?: number; skipped?: number }> {
  const supabase = createServiceClient()
  const { data: broadcast } = await supabase
    .from('whatsapp_broadcasts')
    .select('id, status, audience_filters, created_by, template:whatsapp_templates(id, name, language, status, is_active, body, variable_names)')
    .eq('id', broadcastId)
    .single()

  if (!broadcast) return { success: false, error: 'Broadcast not found' }
  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    return { success: false, error: 'This broadcast has already been started' }
  }
  const template = broadcast.template as unknown as {
    name: string; language: string; status: string; is_active: boolean; body: string; variable_names: string[]
  } | null
  if (!template) return { success: false, error: 'The broadcast has no template' }
  if (template.status !== 'approved') return { success: false, error: 'The template is not approved by WhatsApp yet' }

  const filters = (broadcast.audience_filters ?? {}) as BroadcastAudienceFilters
  let query = supabase
    .from('leads')
    .select('id, full_name, phone, project:projects(name), advisor:profiles!leads_assigned_to_fkey(full_name, phone)')
    .eq('is_active', true)
    .not('phone', 'is', null)
  if (filters.stage?.length) query = query.in('stage', filters.stage)
  if (filters.source?.length) query = query.in('source', filters.source)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.city) query = query.ilike('city', `%${filters.city}%`)
  if (filters.budget_min) query = query.gte('budget_max', filters.budget_min)
  if (filters.budget_max) query = query.lte('budget_min', filters.budget_max)

  // Runs on the service client (the cron has no session), so the creator's reach is
  // applied here: admins message everyone, a manager only their own branch — the same
  // line the WhatsApp inbox draws.
  const { data: creator } = await supabase.from('profiles').select('role, branch_id').eq('id', broadcast.created_by).maybeSingle()
  if (creator?.role !== 'admin') {
    if (creator?.role !== 'manager' || !creator.branch_id) {
      return { success: false, error: 'Only an admin, or a manager with a branch, can send a broadcast' }
    }
    query = query.eq('branch_id', creator.branch_id)
  }

  const { data: leads, error: leadsError } = await query.limit(5000)
  if (leadsError) return { success: false, error: leadsError.message }
  if (!leads?.length) return { success: false, error: 'No leads match the audience filters' }

  // One message per WhatsApp number, however many lead rows share it.
  const byNumber = new Map<string, (typeof leads)[number]>()
  for (const lead of leads) {
    const wa = toWhatsAppNumber(lead.phone as string)
    if (wa && !byNumber.has(wa)) byNumber.set(wa, lead)
  }
  const numbers = [...byNumber.keys()]

  const optedOut = new Set<string>()
  for (let i = 0; i < numbers.length; i += 500) {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('wa_id')
      .eq('opted_out', true)
      .in('wa_id', numbers.slice(i, i + 500))
    data?.forEach((c) => optedOut.add(c.wa_id as string))
  }

  let skipped = 0
  const rows = numbers.map((wa) => {
    const lead = byNumber.get(wa)!
    const project = lead.project as unknown as { name?: string } | null
    const advisor = lead.advisor as unknown as { full_name?: string; phone?: string } | null
    const { values, missing } = fillTemplateVariables(template.variable_names, {
      name: lead.full_name || 'there',
      project: project?.name,
      advisor_name: advisor?.full_name,
      advisor_phone: advisor?.phone,
      overrides: filters.variables,
    })
    const vars = Object.fromEntries(template.variable_names.map((n, i) => [n, values[i]]))
    const base = { broadcast_id: broadcastId, lead_id: lead.id, phone: wa, name: lead.full_name, template_variables: vars }
    if (optedOut.has(wa)) {
      skipped++
      return { ...base, status: 'failed', failed_reason: 'Opted out of WhatsApp', skipped_opted_out: true }
    }
    if (missing.length) {
      skipped++
      return { ...base, status: 'failed', failed_reason: `No value for: ${missing.join(', ')}`, skipped_opted_out: false }
    }
    return { ...base, status: 'queued', skipped_opted_out: false }
  })

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('whatsapp_broadcast_recipients').insert(rows.slice(i, i + 500))
    if (error) return { success: false, error: `Could not queue recipients: ${error.message}` }
  }

  await supabase.from('whatsapp_broadcasts').update({
    status: 'sending',
    sent_at: new Date().toISOString(),
    audience_count: rows.length,
    updated_at: new Date().toISOString(),
  }).eq('id', broadcastId)

  await recomputeBroadcastTotals(broadcastId)
  return { success: true, queued: rows.length - skipped, skipped }
}

export async function processBroadcast(
  broadcastId: string,
  budgetMs = 45_000,
): Promise<{ sent: number; failed: number; remaining: number; rateLimited: boolean }> {
  const supabase = createServiceClient()
  const started = Date.now()
  let sent = 0
  let failed = 0
  let rateLimited = false

  const { data: broadcast } = await supabase
    .from('whatsapp_broadcasts')
    .select('id, created_by, template:whatsapp_templates(name, language, body, variable_names)')
    .eq('id', broadcastId)
    .single()
  const template = broadcast?.template as unknown as { name: string; language: string; body: string; variable_names: string[] } | null

  if (broadcast && template) {
    outer: while (Date.now() - started < budgetMs) {
      const { data: batch } = await supabase
        .from('whatsapp_broadcast_recipients')
        .select('id, lead_id, phone, template_variables')
        .eq('broadcast_id', broadcastId)
        .eq('status', 'queued')
        .order('created_at')
        .limit(25)
      if (!batch?.length) break

      for (const r of batch) {
        if (Date.now() - started >= budgetMs) break outer
        const vars = (r.template_variables ?? {}) as Record<string, string>
        // Pass variables as a named object so AgencyX can validate each by name and
        // catch mismatches when a template is reordered. The variable_names array is the
        // canonical order that maps names → positions.
        const namedVars = Object.fromEntries(
          template.variable_names.map((n) => [n, vars[n] ?? ''])
        )
        const result = await sendWhatsAppTemplate({
          to: r.phone as string,
          name: template.name,
          language: template.language,
          variables: namedVars,
          reference: `bcast_${r.id}`,
        })
        if (result.rateLimited) {
          rateLimited = true
          break outer
        }
        const now = new Date().toISOString()
        if (result.success) {
          sent++
          await supabase.from('whatsapp_broadcast_recipients')
            .update({ status: 'sent', wa_message_id: result.messageId ?? null, sent_at: now })
            .eq('id', r.id)
          await recordOutboundWhatsApp({
            to: r.phone as string,
            body: renderTemplate(template.body, template.variable_names, vars),
            type: 'template',
            waMessageId: result.messageId,
            templateName: template.name,
            templateParams: vars,
            sentBy: broadcast.created_by,
            broadcastId,
            leadId: r.lead_id as string | null,
          })
        } else {
          failed++
          await supabase.from('whatsapp_broadcast_recipients')
            .update({ status: 'failed', failed_reason: result.error ?? 'Send failed' })
            .eq('id', r.id)
        }
      }
    }
  }

  const { count: remaining } = await supabase
    .from('whatsapp_broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'queued')

  if (!remaining) {
    await supabase.from('whatsapp_broadcasts')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', broadcastId)
      .eq('status', 'sending')
  }
  await recomputeBroadcastTotals(broadcastId)
  return { sent, failed, remaining: remaining ?? 0, rateLimited }
}

/** Totals are always recounted from recipient rows, so a retry or receipt can't skew them. */
export async function recomputeBroadcastTotals(broadcastId: string): Promise<void> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('whatsapp_broadcast_recipients')
    .select('status, replied, skipped_opted_out')
    .eq('broadcast_id', broadcastId)
  const rows = data ?? []
  await supabase.from('whatsapp_broadcasts').update({
    total_sent: rows.filter((r) => SENT_STATES.includes(r.status as string)).length,
    total_delivered: rows.filter((r) => r.status === 'delivered' || r.status === 'read').length,
    total_read: rows.filter((r) => r.status === 'read').length,
    total_replied: rows.filter((r) => r.replied).length,
    total_failed: rows.filter((r) => r.status === 'failed').length,
    updated_at: new Date().toISOString(),
  }).eq('id', broadcastId)
}

const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 }

/** A delivery receipt for a message that may be a broadcast send. Never moves backwards. */
export async function applyBroadcastReceipt(wamid: string, status: string, at: string, reason?: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: recipient } = await supabase
    .from('whatsapp_broadcast_recipients')
    .select('id, broadcast_id, status')
    .eq('wa_message_id', wamid)
    .maybeSingle()
  if (!recipient) return

  const current = recipient.status as string
  if (status === 'failed') {
    if (current === 'read' || current === 'failed') return
  } else if ((RANK[status] ?? -1) <= (RANK[current] ?? -1)) {
    return
  }

  const update: Record<string, unknown> = { status }
  if (status === 'delivered') update.delivered_at = at
  if (status === 'read') {
    update.read_at = at
    if (current !== 'delivered') update.delivered_at = at
  }
  if (status === 'failed') update.failed_reason = reason ?? 'Failed'
  await supabase.from('whatsapp_broadcast_recipients').update(update).eq('id', recipient.id)
  await recomputeBroadcastTotals(recipient.broadcast_id as string)
}

/** An inbound message within a week of a broadcast counts as a reply to it. */
export async function markBroadcastReplied(waId: string): Promise<void> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data } = await supabase
    .from('whatsapp_broadcast_recipients')
    .update({ replied: true })
    .eq('phone', waId)
    .eq('replied', false)
    .in('status', SENT_STATES)
    .gte('sent_at', since)
    .select('broadcast_id')
  const ids = [...new Set((data ?? []).map((r) => r.broadcast_id as string))]
  for (const id of ids) await recomputeBroadcastTotals(id)
}

/** Cron: start scheduled broadcasts that are due, and continue any still sending. */
export async function runDueBroadcasts(budgetMs = 50_000): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()
  const started = Date.now()
  const { data: due } = await supabase
    .from('whatsapp_broadcasts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
  const queued: Record<string, string> = {}
  for (const b of due ?? []) {
    const r = await queueBroadcast(b.id)
    queued[b.id] = r.success ? `queued ${r.queued}` : `error: ${r.error}`
  }

  const { data: sending } = await supabase.from('whatsapp_broadcasts').select('id').eq('status', 'sending')
  const processed: Record<string, unknown> = {}
  for (const b of sending ?? []) {
    const left = budgetMs - (Date.now() - started)
    if (left < 5_000) break
    processed[b.id] = await processBroadcast(b.id, left)
  }
  return { queued, processed }
}
