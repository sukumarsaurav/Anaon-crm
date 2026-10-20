import { createServiceClient } from '@/lib/supabase/service'
import { notifyUsers } from '@/lib/notifications/notify'
import type { BroadcastAudienceFilters, BroadcastAudiencePreview } from '@/types/whatsapp'
import { sendWhatsAppTemplate, recordOutboundWhatsApp, isMarketingCategory } from './send'
import { fillTemplateVariables } from './variables'
import { renderTemplate } from './template-render'
import { toWhatsAppNumber } from './phone'

/**
 * Broadcast engine. Plain module (service client) — reached only through the role-checked
 * server actions in actions.ts and the cron route.
 *
 * Two steps, so a big audience survives function timeouts and AgencyX's per-key rate
 * limit (120/min by default):
 *   1. queueBroadcast   — atomically claim the broadcast (draft|scheduled → queueing),
 *                         resolve the audience once into whatsapp_broadcast_recipients rows
 *                         ('queued'), with opt-outs and unfillable rows settled, then
 *                         → sending. Any failure rolls back to draft with last_error.
 *   2. processBroadcast — send queued rows for up to `budgetMs`; stop early on a 429 or an
 *                         outage (rows stay queued), and leave the rest for the next run
 *                         (the page's auto-continue, Continue, or the 5-minute cron).
 * Each send uses the recipient row id as AgencyX's client_reference, and recipients are
 * unique per (broadcast, number), so nobody can be messaged twice by one broadcast.
 */

export type { BroadcastAudienceFilters }

const SENT_STATES = ['sent', 'delivered', 'read']
/** Won and lost leads are left out unless their stage is picked explicitly. */
const EXCLUDED_BY_DEFAULT = ['closed_won', 'not_interested']
const AUDIENCE_PAGE = 1000
export const MAX_AUDIENCE = 20_000
export const CANCELLED_REASON = 'Broadcast cancelled'
export const OPTED_OUT_REASON = 'Opted out of WhatsApp'
export const NO_OPT_IN_REASON = 'Lead has not opted in to WhatsApp'
export const MISSING_VALUE_PREFIX = 'No value for:'

type ServiceClient = ReturnType<typeof createServiceClient>

interface BroadcastTemplate {
  name: string
  language: string
  category: string
  status: string
  is_active: boolean
  body: string
  variable_names: string[]
}

interface RecipientDraft {
  lead_id: string
  phone: string
  name: string | null
  template_variables: Record<string, string>
  status: 'queued' | 'failed'
  failed_reason?: string
  skipped_opted_out: boolean
}

const asStrings = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))] : undefined
const asNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Keeps only the filter keys and shapes the engine understands (they arrive from the browser). */
export function sanitizeAudienceFilters(raw: unknown): BroadcastAudienceFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: BroadcastAudienceFilters = {}
  const stage = asStrings(r.stage)
  const source = asStrings(r.source)
  const temperature = asStrings(r.temperature)
  if (stage?.length) out.stage = stage
  if (source?.length) out.source = source
  if (temperature?.length) out.temperature = temperature
  if (typeof r.project_id === 'string' && r.project_id.trim()) out.project_id = r.project_id.trim()
  if (typeof r.city === 'string' && r.city.trim()) out.city = r.city.trim().slice(0, 100)
  const min = asNumber(r.budget_min)
  const max = asNumber(r.budget_max)
  if (min) out.budget_min = min
  if (max) out.budget_max = max
  if (r.variables && typeof r.variables === 'object') {
    const vars = Object.fromEntries(
      Object.entries(r.variables as Record<string, unknown>)
        .filter(([k, v]) => k.trim() && typeof v === 'string' && v.trim())
        .map(([k, v]) => [k.trim(), (v as string).trim()]),
    )
    if (Object.keys(vars).length) out.variables = vars
  }
  return out
}

/**
 * Resolves filters to one recipient per WhatsApp number, settled up front:
 * opted out (STOP, marketing templates only), not opted in (any template), or a template
 * variable with no value. Runs on the service client, so the creator's reach is applied
 * here: admins message everyone, a manager only their own branch — the line the inbox draws.
 */
export async function resolveAudience(
  supabase: ServiceClient,
  filters: BroadcastAudienceFilters,
  creatorId: string | null,
  template: Pick<BroadcastTemplate, 'category' | 'variable_names'>,
): Promise<{ ok: true; rows: RecipientDraft[]; counts: BroadcastAudiencePreview } | { ok: false; error: string }> {
  const { data: creator } = creatorId
    ? await supabase.from('profiles').select('role, branch_id').eq('id', creatorId).maybeSingle()
    : { data: null }
  let branchId: string | null = null
  if (creator?.role !== 'admin') {
    if (creator?.role !== 'manager' || !creator.branch_id) {
      return { ok: false, error: 'Only an admin, or a manager with a branch, can send a broadcast' }
    }
    branchId = creator.branch_id as string
  }

  type LeadRow = { id: string; full_name: string | null; phone: string; whatsapp_opt_in: boolean | null; project: unknown; advisor: unknown }
  const build = () => {
    // Explicit row type: inferring it from the select string, through this many optional
    // filters, exceeds TypeScript's instantiation depth.
    let q = supabase
      .from('leads')
      .select<string, LeadRow>('id, full_name, phone, whatsapp_opt_in, project:projects(name), advisor:profiles!leads_assigned_to_fkey(full_name, phone)')
      .eq('is_active', true)
      .not('phone', 'is', null)
    if (filters.stage?.length) q = q.in('stage', filters.stage)
    else {
      // .not() on an enum column trips TypeScript's instantiation depth; same builder, looser type.
      const loose = q as unknown as { not: (column: string, op: string, value: string) => typeof q }
      q = loose.not('stage', 'in', `(${EXCLUDED_BY_DEFAULT.join(',')})`)
    }
    if (filters.source?.length) q = q.in('source', filters.source)
    if (filters.temperature?.length) q = q.in('temperature', filters.temperature)
    if (filters.project_id) q = q.eq('project_id', filters.project_id)
    if (filters.city) q = q.ilike('city', `%${filters.city.replace(/[%_]/g, '')}%`)
    if (filters.budget_min) q = q.gte('budget_max', filters.budget_min)
    if (filters.budget_max) q = q.lte('budget_min', filters.budget_max)
    if (branchId) q = q.eq('branch_id', branchId)
    // Newest first, so a number shared by several leads is addressed by its latest name.
    return q.order('created_at', { ascending: false }).order('id')
  }

  // Paged: PostgREST caps a single response, which silently truncated big audiences.
  const leads: LeadRow[] = []
  for (let from = 0; ; from += AUDIENCE_PAGE) {
    const { data, error } = await build().range(from, from + AUDIENCE_PAGE - 1)
    if (error) return { ok: false, error: error.message }
    leads.push(...(data ?? []))
    if (leads.length > MAX_AUDIENCE) {
      return { ok: false, error: `More than ${MAX_AUDIENCE.toLocaleString('en-IN')} leads match - narrow the filters (e.g. by stage, project or city) and send in parts` }
    }
    if (!data || data.length < AUDIENCE_PAGE) break
  }

  // One message per WhatsApp number, however many lead rows share it. If any of them said
  // "no WhatsApp", the number is skipped.
  const byNumber = new Map<string, LeadRow>()
  const noOptIn = new Set<string>()
  for (const lead of leads) {
    const wa = toWhatsAppNumber(lead.phone)
    if (!wa) continue
    if (lead.whatsapp_opt_in === false) noOptIn.add(wa)
    if (!byNumber.has(wa)) byNumber.set(wa, lead)
  }
  const numbers = [...byNumber.keys()]

  // A STOP opts out of marketing only; a utility broadcast (e.g. a possession update)
  // still reaches them.
  const optedOut = new Set<string>()
  for (let i = 0; isMarketingCategory(template.category) && i < numbers.length; i += 500) {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('wa_id')
      .eq('opted_out', true)
      .in('wa_id', numbers.slice(i, i + 500))
    if (error) return { ok: false, error: `Could not check opt-outs: ${error.message}` }
    data?.forEach((c) => optedOut.add(c.wa_id as string))
  }

  const counts: BroadcastAudiencePreview = { matched: numbers.length, sendable: 0, optedOut: 0, noOptIn: 0, missingVariables: 0 }
  const rows: RecipientDraft[] = numbers.map((wa) => {
    const lead = byNumber.get(wa)!
    const project = lead.project as { name?: string } | null
    const advisor = lead.advisor as { full_name?: string; phone?: string } | null
    const { values, missing } = fillTemplateVariables(template.variable_names, {
      name: lead.full_name || 'there',
      project: project?.name,
      advisor_name: advisor?.full_name,
      advisor_phone: advisor?.phone,
      overrides: filters.variables,
    })
    const vars = Object.fromEntries(template.variable_names.map((n, i) => [n, values[i]]))
    const base = { lead_id: lead.id, phone: wa, name: lead.full_name, template_variables: vars }
    if (optedOut.has(wa)) {
      counts.optedOut++
      return { ...base, status: 'failed', failed_reason: OPTED_OUT_REASON, skipped_opted_out: true }
    }
    if (noOptIn.has(wa)) {
      counts.noOptIn++
      return { ...base, status: 'failed', failed_reason: NO_OPT_IN_REASON, skipped_opted_out: true }
    }
    if (missing.length) {
      counts.missingVariables++
      return { ...base, status: 'failed', failed_reason: `${MISSING_VALUE_PREFIX} ${missing.join(', ')}`, skipped_opted_out: false }
    }
    counts.sendable++
    return { ...base, status: 'queued', skipped_opted_out: false }
  })

  return { ok: true, rows, counts }
}

export async function queueBroadcast(
  broadcastId: string,
  opts: { notifyOnFailure?: boolean } = {},
): Promise<{ success: boolean; error?: string; queued?: number; skipped?: number }> {
  const supabase = createServiceClient()
  const { data: broadcast } = await supabase
    .from('whatsapp_broadcasts')
    .select('id, name, status, audience_filters, created_by, template:whatsapp_templates(id, name, language, category, status, is_active, body, variable_names)')
    .eq('id', broadcastId)
    .single()

  if (!broadcast) return { success: false, error: 'Broadcast not found' }
  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    return { success: false, error: 'This broadcast has already been started' }
  }

  // The claim: only one caller (a double click, the cron, a second manager) gets past this.
  const { data: claimed } = await supabase
    .from('whatsapp_broadcasts')
    .update({ status: 'queueing', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', broadcastId)
    .eq('status', broadcast.status)
    .select('id')
  if (!claimed?.length) return { success: false, error: 'This broadcast is already being started' }

  const fail = async (error: string) => {
    await supabase.from('whatsapp_broadcast_recipients').delete().eq('broadcast_id', broadcastId)
    await supabase.from('whatsapp_broadcasts')
      .update({ status: 'draft', last_error: error, updated_at: new Date().toISOString() })
      .eq('id', broadcastId)
      .eq('status', 'queueing')
    if (opts.notifyOnFailure && broadcast.created_by) {
      await notifyUsers([broadcast.created_by as string], {
        title: 'Scheduled broadcast did not start',
        message: `"${broadcast.name}": ${error}. It is back in draft.`,
        type: 'system', related_type: 'whatsapp_broadcast', related_id: broadcastId,
        action_url: `/whatsapp/broadcasts/${broadcastId}`,
      })
    }
    return { success: false, error }
  }

  const template = broadcast.template as unknown as BroadcastTemplate | null
  if (!template) return fail('The broadcast has no template')
  if (template.status !== 'approved') return fail('The template is not approved by WhatsApp')
  if (!template.is_active) return fail('The template is switched off')

  const filters = sanitizeAudienceFilters(broadcast.audience_filters)
  const audience = await resolveAudience(supabase, filters, broadcast.created_by as string | null, template)
  if (!audience.ok) return fail(audience.error)
  if (!audience.rows.length) return fail('No leads match the audience filters')

  for (let i = 0; i < audience.rows.length; i += 500) {
    const chunk = audience.rows.slice(i, i + 500).map((r) => ({ ...r, broadcast_id: broadcastId }))
    const { error } = await supabase
      .from('whatsapp_broadcast_recipients')
      .upsert(chunk, { onConflict: 'broadcast_id,phone', ignoreDuplicates: true })
    if (error) return fail(`Could not queue recipients: ${error.message}`)
  }

  await supabase.from('whatsapp_broadcasts').update({
    status: 'sending',
    sent_at: new Date().toISOString(),
    audience_count: audience.rows.length,
    updated_at: new Date().toISOString(),
  }).eq('id', broadcastId).eq('status', 'queueing')

  await recomputeBroadcastTotals(broadcastId)
  return { success: true, queued: audience.counts.sendable, skipped: audience.rows.length - audience.counts.sendable }
}

export interface ProcessResult {
  sent: number
  failed: number
  remaining: number
  rateLimited: boolean
  /** Sending paused on an outage; the rows stay queued for the next run. */
  error?: string
}

export async function processBroadcast(broadcastId: string, budgetMs = 45_000): Promise<ProcessResult> {
  const supabase = createServiceClient()
  const started = Date.now()
  let sent = 0
  let failed = 0
  let rateLimited = false
  let paused: string | undefined

  const { data: broadcast } = await supabase
    .from('whatsapp_broadcasts')
    .select('id, created_by, template:whatsapp_templates(name, language, category, body, variable_names)')
    .eq('id', broadcastId)
    .single()
  const template = broadcast?.template as unknown as { name: string; language: string; category: string; body: string; variable_names: string[] } | null

  if (broadcast && template) {
    outer: while (Date.now() - started < budgetMs) {
      // Re-read the status every batch, so a Cancel stops the run within a few sends.
      const { data: current } = await supabase.from('whatsapp_broadcasts').select('status').eq('id', broadcastId).single()
      if (current?.status !== 'sending') break

      const { data: batch } = await supabase
        .from('whatsapp_broadcast_recipients')
        .select('id, lead_id, phone, template_variables')
        .eq('broadcast_id', broadcastId)
        .eq('status', 'queued')
        .order('created_at')
        .limit(10)
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
          category: template.category,
        })
        if (result.rateLimited) {
          rateLimited = true
          break outer
        }
        if (result.retryable) {
          // AgencyX/WhatsApp unreachable: failing the row would burn the audience on an outage.
          paused = result.error ?? 'WhatsApp is unreachable'
          break outer
        }
        const now = new Date().toISOString()
        if (result.success) {
          sent++
          await supabase.from('whatsapp_broadcast_recipients')
            .update({ status: 'sent', wa_message_id: result.messageId ?? null, sent_at: now, failed_reason: null })
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
            // AgencyX knew of an opt-out the CRM hadn't mirrored yet (respect_opt_out).
            .update({
              status: 'failed',
              failed_reason: result.optedOut ? OPTED_OUT_REASON : result.error ?? 'Send failed',
              skipped_opted_out: Boolean(result.optedOut),
            })
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
      .update({ status: 'sent', last_error: null, updated_at: new Date().toISOString() })
      .eq('id', broadcastId)
      .eq('status', 'sending')
  } else if (paused) {
    await supabase.from('whatsapp_broadcasts')
      .update({ last_error: `Paused: ${paused}`, updated_at: new Date().toISOString() })
      .eq('id', broadcastId)
  }
  await recomputeBroadcastTotals(broadcastId)
  return { sent, failed, remaining: remaining ?? 0, rateLimited, error: paused }
}

/**
 * Puts send-time failures back in the queue: rows WhatsApp never accepted (no wa_message_id),
 * other than opt-outs, unfillable variables and cancellations, which a retry can't fix.
 * The same recipient id is the idempotency reference, so a retry can't double-send.
 */
export async function requeueFailedRecipients(broadcastId: string): Promise<{ success: boolean; error?: string; requeued?: number }> {
  const supabase = createServiceClient()
  const { data: broadcast } = await supabase.from('whatsapp_broadcasts').select('status').eq('id', broadcastId).single()
  if (!broadcast || !['sending', 'sent'].includes(broadcast.status as string)) {
    return { success: false, error: 'Only a sending or sent broadcast can retry its failures' }
  }
  const { data, error } = await retryableFailures(
    supabase.from('whatsapp_broadcast_recipients').update({ status: 'queued', failed_reason: null }),
    broadcastId,
  ).select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'There are no failed messages that can be retried' }

  await supabase.from('whatsapp_broadcasts')
    .update({ status: 'sending', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', broadcastId)
    .in('status', ['sending', 'sent'])
  await recomputeBroadcastTotals(broadcastId)
  return { success: true, requeued: data.length }
}

/** The filter for failures a retry can fix (shared by the retry and the page's count). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function retryableFailures<Q extends { eq: any; is: any; not: any; neq: any }>(query: Q, broadcastId: string): Q {
  return query
    .eq('broadcast_id', broadcastId)
    .eq('status', 'failed')
    .eq('skipped_opted_out', false)
    .is('wa_message_id', null)
    .not('failed_reason', 'like', `${MISSING_VALUE_PREFIX}%`)
    .neq('failed_reason', CANCELLED_REASON)
}

/** Totals are always recounted from recipient rows, so a retry or receipt can't skew them. */
export async function recomputeBroadcastTotals(broadcastId: string): Promise<void> {
  const supabase = createServiceClient()
  const count = async (apply: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count: n } = await apply(
      supabase.from('whatsapp_broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', broadcastId),
    )
    return n ?? 0
  }
  // Counted in SQL: reading the rows back was capped at PostgREST's row limit.
  const [sent, delivered, read, replied, failed] = await Promise.all([
    count((q) => q.in('status', SENT_STATES)),
    count((q) => q.in('status', ['delivered', 'read'])),
    count((q) => q.eq('status', 'read')),
    count((q) => q.eq('replied', true)),
    count((q) => q.eq('status', 'failed')),
  ])
  await supabase.from('whatsapp_broadcasts').update({
    total_sent: sent,
    total_delivered: delivered,
    total_read: read,
    total_replied: replied,
    total_failed: failed,
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

/**
 * Cron (every 5 minutes via pg_cron → pg_net, daily via Vercel as a fallback): recover
 * starts that were interrupted, start scheduled broadcasts that are due, and continue any
 * still sending.
 */
export async function runDueBroadcasts(budgetMs = 50_000): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()
  const started = Date.now()

  // A start that died mid-queue (function killed) would otherwise sit in 'queueing' forever.
  const { data: stale } = await supabase
    .from('whatsapp_broadcasts')
    .select('id')
    .eq('status', 'queueing')
    .lt('updated_at', new Date(Date.now() - 10 * 60_000).toISOString())
  for (const b of stale ?? []) {
    await supabase.from('whatsapp_broadcast_recipients').delete().eq('broadcast_id', b.id)
    await supabase.from('whatsapp_broadcasts')
      .update({ status: 'draft', last_error: 'Starting was interrupted - press Send now to try again', updated_at: new Date().toISOString() })
      .eq('id', b.id)
      .eq('status', 'queueing')
  }

  const { data: due } = await supabase
    .from('whatsapp_broadcasts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
  const queued: Record<string, string> = {}
  for (const b of due ?? []) {
    const r = await queueBroadcast(b.id, { notifyOnFailure: true })
    queued[b.id] = r.success ? `queued ${r.queued}` : `error: ${r.error}`
  }

  const { data: sending } = await supabase.from('whatsapp_broadcasts').select('id').eq('status', 'sending')
  const processed: Record<string, unknown> = {}
  for (const b of sending ?? []) {
    const left = budgetMs - (Date.now() - started)
    if (left < 5_000) break
    processed[b.id] = await processBroadcast(b.id, left)
  }
  return { recovered: (stale ?? []).length, queued, processed }
}
