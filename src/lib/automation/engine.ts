import { todayIST } from '@/lib/datetime'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { TriggerEvent, AutomationContext, Automation, AutomationCondition } from '@/types/automation'
import { sendWhatsAppText, sendWhatsAppTemplate, isWhatsAppOptedOut, isMarketingCategory, recordOutboundWhatsApp } from '@/lib/whatsapp/send'
import { fillTemplateVariables } from '@/lib/whatsapp/variables'
import { renderTemplate } from '@/lib/whatsapp/template-render'
import { sendEmail, emailConfigured } from '@/lib/email/client'
import { genericEmail } from '@/lib/email/templates'
import { notifyUsers } from '@/lib/notifications/notify'

function fillTokens(text: string, ctx: AutomationContext, fallbackName = 'there'): string {
  // Global and whitespace-tolerant: String.replace with a string only changed the first token.
  return (text ?? '')
    .replace(/\{\{\s*lead_name\s*\}\}/g, ctx.lead?.full_name ?? fallbackName)
    .replace(/\{\{\s*client_name\s*\}\}/g, ctx.client?.full_name ?? fallbackName)
    .replace(/\{\{\s*amount\s*\}\}/g, ctx.payment?.amount_due != null ? Number(ctx.payment.amount_due).toLocaleString('en-IN') : '')
    .replace(/\{\{\s*days\s*\}\}/g, String(ctx.extra?.daysOverdue ?? ''))
}

// ── Condition evaluation ──────────────────────────────────────────────────────

function getContextValue(ctx: AutomationContext, field: string): string | null {
  const lead = ctx.lead
  if (field === 'source')     return lead?.source ?? null
  if (field === 'utm_source') return lead?.utm_source ?? null
  if (field === 'stage')      return lead?.stage ?? null
  if (field === 'score')      return String(lead?.score ?? '')
  if (field === 'project_id') return lead?.project_id ?? ctx.booking?.project_id ?? ctx.project?.id ?? null
  return null
}

function checkCondition(cond: AutomationCondition, ctx: AutomationContext): boolean {
  const val = getContextValue(ctx, cond.field)
  if (val === null) return false
  switch (cond.operator) {
    // Case-insensitive: "Facebook" and "facebook" are the same source.
    case 'equals':       return val.trim().toLowerCase() === String(cond.value ?? '').trim().toLowerCase()
    case 'not_equals':   return val.trim().toLowerCase() !== String(cond.value ?? '').trim().toLowerCase()
    case 'contains':     return val.toLowerCase().includes(cond.value.toLowerCase())
    case 'greater_than': return parseFloat(val) > parseFloat(cond.value)
    case 'less_than':    return parseFloat(val) < parseFloat(cond.value)
    default:             return false
  }
}

/** Each condition with the record's actual value, for the test run. */
export function explainConditions(automation: Pick<Automation, 'conditions'>, ctx: AutomationContext) {
  return (automation.conditions ?? []).map((c) => ({ ...c, actual: getContextValue(ctx, c.field), pass: checkCondition(c, ctx) }))
}

function passesConditions(automation: Automation, ctx: AutomationContext): boolean {
  const conditions = automation.conditions ?? []
  return conditions.every(c => checkCondition(c, ctx))
}

// ── Action execution ──────────────────────────────────────────────────────────

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * live    — the real thing.
 * preview — work out exactly what would happen (recipient, rendered message, who is notified, the
 *           stage / advisor that would be set) and change nothing.
 * self    — like preview, but WhatsApp / email / notification really go to the tester only.
 */
export interface ExecOptions {
  mode: 'live' | 'preview' | 'self'
  self?: { userId: string; phone?: string | null; email?: string | null }
}

export type ActionOutcome = { success: boolean; result?: unknown; error?: string; preview?: Record<string, unknown> }

async function executeAction(
  automation: Automation,
  ctx: AutomationContext,
  supabase: ServiceClient,
  /** Idempotency key for outbound messages, so a retried run can't double-send. */
  reference?: string | null,
  opts: ExecOptions = { mode: 'live' },
): Promise<ActionOutcome> {
  const payload = automation.action_payload ?? {}
  const live = opts.mode === 'live'
  const testRef = `test_${automation.id}_${Date.now()}`

  switch (automation.action_type) {
    case 'send_whatsapp': {
      // Older automations were saved without a recipient (the builder showed "Lead" but
      // didn't store it): fall back to whoever the event is about.
      const recipient = payload.recipient ?? (ctx.lead ? 'lead' : 'client')
      const phone = recipient === 'lead' ? ctx.lead?.phone
        : recipient === 'client' ? ctx.client?.phone
        : null
      if (!phone) return { success: false, error: 'No phone number in context' }
      const leadId = ctx.lead?.id ?? null
      const optedOut = await isWhatsAppOptedOut(phone)
      const OPTED_OUT = { success: false, error: 'Contact has opted out of WhatsApp marketing' }

      // A template is the only thing WhatsApp delivers to someone who hasn't messaged in
      // the last 24 hours — i.e. almost every automation recipient. Free text is kept for
      // flows that reply inside an open chat.
      if (payload.template_name) {
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('name, language, category, status, body, variable_names')
          .eq('name', payload.template_name)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()
        if (!template) {
          return { success: false, error: `WhatsApp template "${payload.template_name}" is not approved — submit it from WhatsApp → Templates` }
        }
        // A STOP blocks marketing; a payment reminder or booking update still goes.
        if (optedOut && isMarketingCategory(template.category)) return OPTED_OUT
        const names = (template.variable_names as string[]) ?? []
        const { values, missing } = fillTemplateVariables(names, {
          name: ctx.lead?.full_name ?? ctx.client?.full_name ?? 'there',
          project: ctx.project?.name,
          advisor_name: ctx.advisor?.full_name,
          amount: ctx.payment?.amount_due != null ? Number(ctx.payment.amount_due).toLocaleString('en-IN') : null,
          due_date: ctx.payment?.due_date,
          date: ctx.booking?.booking_date,
          overrides: payload.template_variables,
        })
        if (missing.length) return { success: false, error: `No value for template variable(s): ${missing.join(', ')}` }
        const rendered = renderTemplate(template.body, names, Object.fromEntries(names.map((n, i) => [n, values[i]])))
        const preview = { channel: 'whatsapp', to: phone, template: template.name, category: template.category, message: rendered }
        if (opts.mode === 'preview') return { success: true, preview }
        if (opts.mode === 'self') {
          if (!opts.self?.phone) return { success: false, error: 'Add your phone number to your profile to receive test messages', preview }
          const sent = await sendWhatsAppTemplate({ to: opts.self.phone, name: template.name, language: template.language, variables: values, reference: testRef, category: template.category })
          return sent.success ? { success: true, preview: { ...preview, sentTo: opts.self.phone } } : { success: false, error: sent.error, preview }
        }
        const sent = await sendWhatsAppTemplate({
          to: phone,
          name: template.name,
          language: template.language,
          variables: values,
          reference: reference ?? undefined,
          category: template.category,
        })
        if (!sent.success) return { success: false, error: sent.error }
        const vars = Object.fromEntries(names.map((n, i) => [n, values[i]]))
        await recordOutboundWhatsApp({
          to: sent.to!, body: renderTemplate(template.body, names, vars), type: 'template',
          waMessageId: sent.messageId, templateName: template.name, templateParams: vars, leadId, isBot: true,
        })
        return { success: true, result: { type: 'whatsapp_template_sent', template: template.name, messageId: sent.messageId, phone } }
      }

      if (optedOut) return OPTED_OUT
      const body = payload.message_body ? fillTokens(payload.message_body, ctx) : null
      if (!body) return { success: false, error: 'Choose a WhatsApp template or write a message' }
      if (!live) {
        const preview = { channel: 'whatsapp', to: phone, message: body, note: 'Free text only reaches people who messaged in the last 24 hours' }
        if (opts.mode === 'preview') return { success: true, preview }
        if (!opts.self?.phone) return { success: false, error: 'Add your phone number to your profile to receive test messages', preview }
        const sent = await sendWhatsAppText({ to: opts.self.phone, text: `[TEST] ${body}`, reference: testRef })
        return sent.success ? { success: true, preview: { ...preview, sentTo: opts.self.phone } } : { success: false, error: sent.error, preview }
      }
      const sent = await sendWhatsAppText({ to: phone, text: body, reference: reference ?? undefined })
      if (!sent.success) {
        return { success: false, error: sent.windowClosed ? `${sent.error} (use a template for this automation)` : sent.error }
      }
      await recordOutboundWhatsApp({ to: sent.to!, body, type: 'text', waMessageId: sent.messageId, leadId, isBot: true })
      return { success: true, result: { type: 'whatsapp_sent', messageId: sent.messageId, phone } }
    }

    case 'send_notification': {
      // In-app (and push, where enabled) to staff in the chosen roles and/or the lead's advisor.
      const roles = payload.notify_roles ?? (payload.notify_assignee ? [] : ['admin'])
      const ids = new Set<string>()
      if (roles.length) {
        const { data: profiles } = await supabase.from('profiles').select('id').in('role', roles).eq('is_active', true)
        for (const p of profiles ?? []) ids.add(p.id)
      }
      if (payload.notify_assignee && ctx.lead?.assigned_to) ids.add(ctx.lead.assigned_to)
      if (!ids.size) return { success: false, error: payload.notify_assignee ? 'The lead has no assigned advisor' : 'Nobody to notify' }

      const userIds = [...ids]
      const title = fillTokens(payload.notification_title ?? automation.name, ctx, 'Unknown')
      const message = fillTokens(payload.notification_body ?? '', ctx, 'Unknown')
      if (!live) {
        const { data: names } = await supabase.from('profiles').select('full_name').in('id', userIds)
        const preview = { channel: 'notification', recipients: (names ?? []).map((n) => n.full_name), title, message }
        if (opts.mode === 'preview' || !opts.self) return { success: true, preview }
        await notifyUsers([opts.self.userId], { title: `[TEST] ${title}`, message, type: 'automation', action_url: ctx.lead?.id ? `/leads/${ctx.lead.id}` : undefined })
        return { success: true, preview: { ...preview, sentTo: 'you' } }
      }
      await notifyUsers(userIds, {
        title,
        message,
        type: 'automation',
        related_type: ctx.lead ? 'lead' : ctx.booking ? 'booking' : null,
        related_id: ctx.lead?.id ?? ctx.booking?.id ?? null,
        action_url: ctx.lead?.id ? `/leads/${ctx.lead.id}` : undefined,
      })
      return { success: true, result: { notified: userIds.length } }
    }

    case 'create_followup': {
      // Follow-ups live on the lead (next_followup_at, picked up by the follow-up reminder cron).
      // This used to insert a lead_activities row of type 'follow_up', which the table rejects; the
      // error was ignored, so the run was logged as a success and nothing was scheduled.
      if (!ctx.lead?.id) return { success: false, error: 'No lead in context' }
      const hours = Number(payload.followup_hours) > 0 ? Number(payload.followup_hours) : 24
      const scheduledAt = new Date(Date.now() + hours * 3600000).toISOString()
      if (!live) return { success: true, preview: { change: 'next follow-up', lead: ctx.lead.full_name, at: scheduledAt, note: payload.followup_note ? fillTokens(payload.followup_note, ctx) : null } }
      const { error } = await supabase.from('leads')
        .update({ next_followup_at: scheduledAt, followup_reminder_sent_at: null, updated_at: new Date().toISOString() })
        .eq('id', ctx.lead.id)
      if (error) return { success: false, error: error.message }
      await supabase.from('lead_activities').insert({
        lead_id: ctx.lead.id, type: 'system', scheduled_at: scheduledAt,
        notes: payload.followup_note?.trim() ? `Follow-up scheduled: ${fillTokens(payload.followup_note, ctx)}` : `Follow-up scheduled by automation "${automation.name}"`,
      })
      return { success: true, result: { scheduled_at: scheduledAt } }
    }

    case 'change_lead_stage': {
      if (!ctx.lead?.id || !payload.new_stage) return { success: false, error: 'Missing lead or stage' }
      if (!live) return { success: true, preview: { change: 'stage', lead: ctx.lead.full_name, from: ctx.lead.stage ?? null, to: payload.new_stage } }
      const { error } = await supabase
        .from('leads')
        .update({ stage: payload.new_stage, updated_at: new Date().toISOString() })
        .eq('id', ctx.lead.id)
      if (error) return { success: false, error: error.message }
      await supabase.from('lead_activities').insert({
        lead_id: ctx.lead.id, type: 'system', stage_from: ctx.lead.stage ?? null, stage_to: payload.new_stage,
        notes: `Stage changed to ${payload.new_stage.replace(/_/g, ' ')} by automation "${automation.name}"`,
      })
      return { success: true, result: { new_stage: payload.new_stage } }
    }

    case 'assign_to_advisor': {
      if (!ctx.lead?.id) return { success: false, error: 'No lead in context' }
      let advisorId = payload.advisor_id ?? null

      if (payload.assignment_mode === 'round_robin' || !advisorId) {
        // Least-loaded active advisor (fewest open leads). "count of all leads % advisors" picked
        // the same person for a burst of leads and ignored how busy anyone was.
        const { data: advisors } = await supabase.from('profiles').select('id').eq('role', 'sales_advisor').eq('is_active', true)
        if (advisors?.length) {
          const loads = await Promise.all(advisors.map(async (a) => {
            const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true })
              .eq('assigned_to', a.id).eq('is_active', true).not('stage', 'in', '(closed_won,not_interested)')
            return { id: a.id, open: count ?? 0 }
          }))
          advisorId = loads.sort((x, y) => x.open - y.open)[0].id
        }
      }

      if (!advisorId) return { success: false, error: 'No advisor available' }
      if (!live) {
        const { data: adv } = await supabase.from('profiles').select('full_name').eq('id', advisorId).maybeSingle()
        return { success: true, preview: { change: 'assign', lead: ctx.lead.full_name, to: adv?.full_name ?? advisorId, mode: payload.assignment_mode ?? 'specific' } }
      }
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: advisorId, updated_at: new Date().toISOString() })
        .eq('id', ctx.lead.id)
      if (error) return { success: false, error: error.message }
      await supabase.from('lead_activities').insert({
        lead_id: ctx.lead.id, type: 'assignment', notes: `Assigned by automation "${automation.name}"`,
      })
      await notifyUsers([advisorId], {
        title: 'New Lead Assigned', message: `${ctx.lead.full_name ?? 'A lead'} has been assigned to you.`,
        type: 'lead_assigned', related_type: 'lead', related_id: ctx.lead.id, action_url: `/leads/${ctx.lead.id}`,
      })
      return { success: true, result: { assigned_to: advisorId } }
    }

    case 'send_email': {
      // The builder never asked for a recipient and no trigger context carries an email, so this
      // action always failed with "No email address in context". The address is looked up now.
      const who = payload.email_recipient ?? (payload.recipient === 'client' ? 'client' : payload.recipient === 'lead' ? 'lead' : payload.email_to ? 'custom' : ctx.lead ? 'lead' : 'client')
      let to: string | null = null
      if (who === 'custom') to = payload.email_to?.trim() || null
      else if (who === 'lead' && ctx.lead?.id) {
        to = ctx.lead.email ?? (await supabase.from('leads').select('email').eq('id', ctx.lead.id).maybeSingle()).data?.email ?? null
      } else if (who === 'client' && ctx.client?.id) {
        to = ctx.client.email ?? (await supabase.from('clients').select('email').eq('id', ctx.client.id).maybeSingle()).data?.email ?? null
      }
      if (!to) return { success: false, error: who === 'custom' ? 'No email address set on the automation' : `The ${who} has no email address` }
      const subject = fillTokens(payload.email_subject ?? 'A message from ANON INDIA', ctx)
      const message = fillTokens(payload.email_body ?? '', ctx)
      const preview = { channel: 'email', to, subject, message }
      if (opts.mode === 'preview') return { success: true, preview }
      if (!emailConfigured()) return { success: false, error: 'Email not configured', preview }
      if (opts.mode === 'self') {
        if (!opts.self?.email) return { success: false, error: 'Your profile has no email address', preview }
        const t = genericEmail(`[TEST] ${subject}`, message)
        const r = await sendEmail({ to: opts.self.email, subject: t.subject, html: t.html })
        return r.success ? { success: true, preview: { ...preview, sentTo: opts.self.email } } : { success: false, error: r.error, preview }
      }

      const tpl = genericEmail(subject, message)
      const sent = await sendEmail({ to, subject: tpl.subject, html: tpl.html })
      if (!sent.success) return { success: false, error: sent.error }
      return { success: true, result: { type: 'email_sent', id: sent.id, to } }
    }

    default:
      return { success: false, error: `Unknown action type: ${automation.action_type}` }
  }
}

/**
 * Test run: conditions with actual values, then the action in preview or send-to-me mode. Nothing
 * is logged to automation_logs and run_count is untouched. Plain module — the server action checks
 * the caller.
 */
export async function testAutomationRun(automation: Automation, ctx: AutomationContext, opts: ExecOptions) {
  const conditions = explainConditions(automation, ctx)
  const outcome = await executeAction(automation, ctx, createServiceClient(), null, opts)
  return { conditions, wouldRun: conditions.every((c) => c.pass), ...outcome }
}

// ── Main fire function ────────────────────────────────────────────────────────

/**
 * Runs one automation's action now and logs it. Used for immediate runs and by the cron
 * for delayed ones (which, before, were logged as successful without running at all).
 */
export async function runAutomation(
  automation: Automation,
  ctx: AutomationContext,
  recordType?: string | null,
  recordId?: string | null,
  reference?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const result = await executeAction(automation, ctx, supabase, reference)
  await supabase.from('automation_logs').insert({
    automation_id:       automation.id,
    trigger_record_type: recordType ?? null,
    trigger_record_id:   recordId ?? null,
    status:              result.success ? 'success' : 'failed',
    error_message:       result.error ?? null,
    action_result:       result.result ?? null,
    lead_name:           ctx.lead?.full_name ?? ctx.client?.full_name ?? null,
    lead_phone:          ctx.lead?.phone ?? ctx.client?.phone ?? null,
    executed_at:         now,
  })
  await supabase.from('automations').update({
    run_count:    (automation.run_count ?? 0) + 1,
    last_fired_at: now,
  }).eq('id', automation.id)
  return { success: result.success, error: result.error }
}

/**
 * Fires every active automation for `trigger`. Runs on the service client: it is called
 * from webhooks and crons that have no signed-in user (where the RLS-bound client saw no
 * automations at all, so nothing ever fired), and an automation is the system acting,
 * not the person who happened to trigger it. Plain module — never a server action.
 */
export function fireAutomations(
  trigger: TriggerEvent,
  ctx: AutomationContext,
  recordType?: string,
  recordId?: string
): Promise<void> {
  // Most callers fire and forget. On Vercel the function can be frozen as soon as the
  // response is sent, which cut those runs (and their WhatsApp sends) off mid-way.
  // Starting now and handing the same promise to after() keeps it alive to completion,
  // while callers that do await it (crons) still wait for it.
  const run = fireAutomationsNow(trigger, ctx, recordType, recordId)
  try {
    after(() => run)
  } catch {
    // Outside a request (scripts/tests): nothing to extend.
  }
  return run
}

// Fired by crons for every matching record on every run (every 15 minutes through the
// GitHub Actions schedule). Each automation may act on a record once a day for these,
// or a client due in 7 days would be messaged ~96 times that day.
const ONCE_PER_DAY: TriggerEvent[] = [
  'payment_due_approaching', 'payment_overdue', 'client_birthday', 'booking_anniversary', 'follow_up_overdue', 'site_visit_reminder',
]

async function alreadyRanToday(supabase: ServiceClient, automationId: string, recordId: string): Promise<boolean> {
  const since = new Date(Date.now() - 20 * 3600_000).toISOString()
  const [logs, pending] = await Promise.all([
    supabase.from('automation_logs').select('id', { count: 'exact', head: true })
      .eq('automation_id', automationId).eq('trigger_record_id', recordId).gte('executed_at', since),
    supabase.from('automation_pending_executions').select('id', { count: 'exact', head: true })
      .eq('automation_id', automationId).eq('trigger_record_id', recordId).gte('created_at', since),
  ])
  return (logs.count ?? 0) + (pending.count ?? 0) > 0
}

async function fireAutomationsNow(
  trigger: TriggerEvent,
  ctx: AutomationContext,
  recordType?: string,
  recordId?: string
): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: automations } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_event', trigger)
      .eq('is_active', true)

    if (!automations || automations.length === 0) return

    // Conditions on "score" never matched: no caller puts the score in the context. Load it once,
    // only when some automation for this trigger actually asks for it.
    const wantsScore = (automations as Automation[]).some((a) => (a.conditions ?? []).some((c) => c.field === 'score'))
    if (wantsScore && ctx.lead?.id && ctx.lead.score == null) {
      const { data: row } = await supabase.from('leads').select('score').eq('id', ctx.lead.id).maybeSingle()
      if (row?.score != null) ctx = { ...ctx, lead: { ...ctx.lead, score: Number(row.score) } }
    }

    for (const automation of automations as Automation[]) {
      if (!passesConditions(automation, ctx)) continue
      if (recordId && ONCE_PER_DAY.includes(trigger) && await alreadyRanToday(supabase, automation.id, recordId)) continue

      const isImmediate = !automation.delay_value || automation.delay_value === 0
      if (isImmediate) {
        // Reference = AgencyX idempotency key. Per day for the daily triggers (next year's
        // birthday must still send); per record otherwise.
        const day = ONCE_PER_DAY.includes(trigger) ? `_${todayIST()}` : ''
        await runAutomation(automation, ctx, recordType, recordId,
          recordId ? `auto_${automation.id}_${trigger}_${recordId}${ctx.milestone?.id ? `_${ctx.milestone.id}` : ''}${day}`.slice(0, 200) : null)
      } else {
        const ms = automation.delay_unit === 'minutes' ? automation.delay_value * 60000
          : automation.delay_unit === 'hours' ? automation.delay_value * 3600000
          : automation.delay_value * 86400000
        await supabase.from('automation_pending_executions').insert({
          automation_id:       automation.id,
          trigger_record_type: recordType ?? null,
          trigger_record_id:   recordId ?? null,
          context_snapshot:    ctx as Record<string, unknown>,
          scheduled_for:       new Date(Date.now() + ms).toISOString(),
          status:              'pending',
        })
      }
    }
  } catch (e) {
    // Non-critical: automation engine should never break the main flow
    console.error('[AutomationEngine] error:', e)
  }
}
