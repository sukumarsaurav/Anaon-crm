import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { TriggerEvent, AutomationContext, Automation, AutomationCondition } from '@/types/automation'
import { sendWhatsAppText, sendWhatsAppTemplate, isWhatsAppOptedOut, isMarketingCategory, recordOutboundWhatsApp } from '@/lib/whatsapp/send'
import { fillTemplateVariables } from '@/lib/whatsapp/variables'
import { renderTemplate } from '@/lib/whatsapp/template-render'
import { sendEmail, emailConfigured } from '@/lib/email/client'
import { genericEmail } from '@/lib/email/templates'
import { notifyUsers } from '@/lib/notifications/notify'

function fillTokens(text: string, ctx: AutomationContext): string {
  return (text ?? '')
    .replace(/\{\{\s*lead_name\s*\}\}/g, ctx.lead?.full_name ?? 'there')
    .replace(/\{\{\s*client_name\s*\}\}/g, ctx.client?.full_name ?? 'there')
    .replace(/\{\{\s*amount\s*\}\}/g, String(ctx.payment?.amount_due ?? ''))
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
    case 'equals':       return val === cond.value
    case 'not_equals':   return val !== cond.value
    case 'contains':     return val.toLowerCase().includes(cond.value.toLowerCase())
    case 'greater_than': return parseFloat(val) > parseFloat(cond.value)
    case 'less_than':    return parseFloat(val) < parseFloat(cond.value)
    default:             return false
  }
}

function passesConditions(automation: Automation, ctx: AutomationContext): boolean {
  const conditions = automation.conditions ?? []
  return conditions.every(c => checkCondition(c, ctx))
}

// ── Action execution ──────────────────────────────────────────────────────────

type ServiceClient = ReturnType<typeof createServiceClient>

async function executeAction(
  automation: Automation,
  ctx: AutomationContext,
  supabase: ServiceClient,
  /** Idempotency key for outbound messages, so a retried run can't double-send. */
  reference?: string | null,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const payload = automation.action_payload ?? {}

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
      const sent = await sendWhatsAppText({ to: phone, text: body, reference: reference ?? undefined })
      if (!sent.success) {
        return { success: false, error: sent.windowClosed ? `${sent.error} (use a template for this automation)` : sent.error }
      }
      await recordOutboundWhatsApp({ to: sent.to!, body, type: 'text', waMessageId: sent.messageId, leadId, isBot: true })
      return { success: true, result: { type: 'whatsapp_sent', messageId: sent.messageId, phone } }
    }

    case 'send_notification': {
      // Create in-app notifications for specified roles
      const roles = payload.notify_roles ?? ['admin']
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .in('role', roles)
        .eq('is_active', true)

      // Global, whitespace-tolerant: String.replace with a string only changed the FIRST token, so a
      // body mentioning {{lead_name}} twice kept the second one as raw text.
      const body = (payload.notification_body ?? '')
        .replace(/\{\{\s*lead_name\s*\}\}/g, ctx.lead?.full_name ?? 'Unknown')
        .replace(/\{\{\s*client_name\s*\}\}/g, ctx.client?.full_name ?? 'Unknown')
        .replace(/\{\{\s*amount\s*\}\}/g, String(ctx.payment?.amount_due ?? ''))

      const userIds = (profiles ?? []).map(p => p.id)
      await notifyUsers(userIds, {
        title: payload.notification_title ?? automation.name,
        message: body,
        type: 'automation',
        related_type: ctx.lead ? 'lead' : ctx.booking ? 'booking' : null,
        related_id: ctx.lead?.id ?? ctx.booking?.id ?? null,
      })
      return { success: true, result: { notified: userIds.length } }
    }

    case 'create_followup': {
      if (!ctx.lead?.id) return { success: false, error: 'No lead in context' }
      const hours = payload.followup_hours ?? 24
      const scheduledAt = new Date(Date.now() + hours * 3600000).toISOString()
      await supabase.from('lead_activities').insert({
        lead_id: ctx.lead.id,
        type: 'follow_up',
        notes: payload.followup_note ?? `Auto follow-up from: ${automation.name}`,
        scheduled_at: scheduledAt,
        performed_by: null,
      })
      return { success: true, result: { scheduled_at: scheduledAt } }
    }

    case 'change_lead_stage': {
      if (!ctx.lead?.id || !payload.new_stage) return { success: false, error: 'Missing lead or stage' }
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
        const { data: advisors } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'sales_advisor')
          .eq('is_active', true)
        if (advisors && advisors.length > 0) {
          const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true })
          advisorId = advisors[(count ?? 0) % advisors.length].id
        }
      }

      if (!advisorId) return { success: false, error: 'No advisor available' }
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
      const to = payload.recipient === 'lead' ? ctx.lead?.email
        : payload.recipient === 'client' ? ctx.client?.email
        : payload.email_to ?? null
      if (!to) return { success: false, error: 'No email address in context' }
      if (!emailConfigured()) return { success: false, error: 'Email not configured' }

      const subject = fillTokens(payload.email_subject ?? 'A message from ANON INDIA', ctx)
      const message = fillTokens(payload.email_body ?? '', ctx)
      const tpl = genericEmail(subject, message)
      const sent = await sendEmail({ to, subject: tpl.subject, html: tpl.html })
      if (!sent.success) return { success: false, error: sent.error }
      return { success: true, result: { type: 'email_sent', id: sent.id, to } }
    }

    default:
      return { success: false, error: `Unknown action type: ${automation.action_type}` }
  }
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
        const day = ONCE_PER_DAY.includes(trigger) ? `_${new Date().toISOString().slice(0, 10)}` : ''
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
