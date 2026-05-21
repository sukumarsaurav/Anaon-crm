import { createClient } from '@/lib/supabase/server'
import type { TriggerEvent, AutomationContext, Automation, AutomationCondition } from '@/types/automation'

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

async function executeAction(
  automation: Automation,
  ctx: AutomationContext,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const payload = automation.action_payload ?? {}

  switch (automation.action_type) {
    case 'send_whatsapp': {
      // Record intent — actual sending happens via WhatsApp module
      const phone = payload.recipient === 'lead' ? ctx.lead?.phone
        : payload.recipient === 'client' ? ctx.client?.phone
        : null
      if (!phone) return { success: false, error: 'No phone number in context' }
      // Log as intent (actual delivery depends on WhatsApp integration being active)
      return { success: true, result: { type: 'whatsapp_intent', template: payload.template_name, phone } }
    }

    case 'send_notification': {
      // Create in-app notifications for specified roles
      const roles = payload.notify_roles ?? ['admin']
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .in('role', roles)
        .eq('is_active', true)

      const body = (payload.notification_body ?? '')
        .replace('{{lead_name}}', ctx.lead?.full_name ?? 'Unknown')
        .replace('{{client_name}}', ctx.client?.full_name ?? 'Unknown')
        .replace('{{amount}}', String(ctx.payment?.amount_due ?? ''))

      const notifications = (profiles ?? []).map(p => ({
        user_id: p.id,
        title: payload.notification_title ?? automation.name,
        message: body,
        type: 'automation',
        related_type: ctx.lead ? 'lead' : ctx.booking ? 'booking' : null,
        related_id: ctx.lead?.id ?? ctx.booking?.id ?? null,
      }))

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications)
      }
      return { success: true, result: { notified: notifications.length } }
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
      return { success: true, result: { assigned_to: advisorId } }
    }

    case 'send_email': {
      // Placeholder — email delivery would go through an email provider
      return { success: true, result: { type: 'email_intent', subject: payload.email_subject } }
    }

    default:
      return { success: false, error: `Unknown action type: ${automation.action_type}` }
  }
}

// ── Main fire function ────────────────────────────────────────────────────────

export async function fireAutomations(
  trigger: TriggerEvent,
  ctx: AutomationContext,
  recordType?: string,
  recordId?: string
): Promise<void> {
  try {
    const supabase = await createClient()

    // Fetch active automations matching this trigger
    const { data: automations } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_event', trigger)
      .eq('is_active', true)

    if (!automations || automations.length === 0) return

    const now = new Date().toISOString()

    for (const automation of automations as Automation[]) {
      // Check conditions
      if (!passesConditions(automation, ctx)) continue

      // Decide: immediate vs delayed
      const isImmediate = !automation.delay_value || automation.delay_value === 0

      if (isImmediate) {
        // Execute now
        const result = await executeAction(automation, ctx, supabase)
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
        // Update run stats
        await supabase.from('automations').update({
          run_count:    automation.run_count + 1,
          last_fired_at: now,
        }).eq('id', automation.id)
      } else {
        // Schedule for later
        const ms = automation.delay_unit === 'minutes' ? automation.delay_value * 60000
          : automation.delay_unit === 'hours' ? automation.delay_value * 3600000
          : automation.delay_value * 86400000
        const scheduledFor = new Date(Date.now() + ms).toISOString()

        await supabase.from('automation_pending_executions').insert({
          automation_id:       automation.id,
          trigger_record_type: recordType ?? null,
          trigger_record_id:   recordId ?? null,
          context_snapshot:    ctx as Record<string, unknown>,
          scheduled_for:       scheduledFor,
        })
      }
    }
  } catch (e) {
    // Non-critical: automation engine should never break the main flow
    console.error('[AutomationEngine] error:', e)
  }
}
