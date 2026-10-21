'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { AUTOMATION_TEMPLATES, TRIGGER_OPTIONS } from '@/types/automation'
import type { TriggerEvent, ActionType, DelayUnit, AutomationCondition, AutomationActionPayload } from '@/types/automation'

async function getAuthUser() {
  const user = (await getProfile())?.user
  if (!user) throw new Error('Unauthorized')
  const profile = (await getProfile())?.profile
  if (!profile || !['admin', 'manager'].includes(profile.role)) throw new Error('Insufficient permissions')
  return user
}

/** Rejects an action that could only ever fail when it fires. */
function payloadProblem(actionType: string, p: AutomationActionPayload): string | null {
  if (actionType === 'send_whatsapp') {
    if (p.recipient && p.recipient !== 'lead' && p.recipient !== 'client') return 'WhatsApp can go to the lead or the client'
    if (!p.template_name && !p.message_body?.trim()) return 'Choose a WhatsApp template (or write a message)'
  }
  if (actionType === 'send_email') {
    if (!p.email_body?.trim()) return 'Write the email body'
    if (p.email_recipient === 'custom' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email_to?.trim() ?? '')) return 'Enter the email address to send to'
  }
  if (actionType === 'send_notification' && !(p.notify_roles?.length) && !p.notify_assignee) return 'Choose who gets the notification'
  if (actionType === 'change_lead_stage' && !p.new_stage) return 'Choose the new stage'
  if (actionType === 'assign_to_advisor' && p.assignment_mode === 'specific' && !p.advisor_id) return 'Choose the advisor'
  return null
}

const ACTIONS = ['send_whatsapp', 'send_notification', 'create_followup', 'change_lead_stage', 'assign_to_advisor', 'send_email']

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw as string) as T } catch { return fallback }
}

/** Fields shared by create and update, validated. */
function readAutomation(formData: FormData): { error: string } | { values: Record<string, unknown> } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Give the automation a name' }
  const trigger = formData.get('trigger_event') as TriggerEvent
  if (!TRIGGER_OPTIONS.some((t) => t.value === trigger)) return { error: 'Choose a trigger' }
  const actionType = formData.get('action_type') as ActionType
  if (!ACTIONS.includes(actionType)) return { error: 'Choose an action' }
  const conditions = parseJson<AutomationCondition[]>(formData.get('conditions'), []).filter((c) => c.field && String(c.value ?? '').trim())
  const action_payload = parseJson<AutomationActionPayload>(formData.get('action_payload'), {})
  const problem = payloadProblem(actionType, action_payload)
  if (problem) return { error: problem }
  const delayValue = Math.max(0, parseInt(formData.get('delay_value') as string) || 0)
  const delayUnit = (formData.get('delay_unit') as DelayUnit) || 'minutes'
  if (!['minutes', 'hours', 'days'].includes(delayUnit)) return { error: 'Choose a delay unit' }
  return {
    values: {
      name,
      description: (formData.get('description') as string)?.trim() || null,
      trigger_event: trigger,
      conditions,
      delay_value: delayValue,
      delay_unit: delayUnit,
      action_type: actionType,
      action_payload,
    },
  }
}

export async function createAutomation(formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()
    const parsed = readAutomation(formData)
    if ('error' in parsed) return { success: false, error: parsed.error }

    const { error } = await supabase.from('automations').insert({
      ...parsed.values,
      is_active:   formData.get('is_active') === 'true',
      is_template: false,
      created_by:  user.id,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateAutomation(id: string, formData: FormData) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const parsed = readAutomation(formData)
    if ('error' in parsed) return { success: false, error: parsed.error }

    const { error } = await supabase.from('automations')
      .update({ ...parsed.values, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    revalidatePath(`/automation/${id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleAutomation(id: string, isActive: boolean) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    if (isActive) {
      // Switching on an automation whose WhatsApp template isn't approved only produced a failed run
      // for every event (both live automations were in that state).
      const { data: a } = await supabase.from('automations').select('action_type, action_payload').eq('id', id).maybeSingle()
      const waName = a?.action_type === 'send_whatsapp' ? (a.action_payload as AutomationActionPayload)?.template_name : null
      if (waName) {
        const { data: wa } = await supabase.from('whatsapp_templates').select('status').eq('name', waName).maybeSingle()
        if (wa?.status !== 'approved') return { success: false, error: `WhatsApp template "${waName}" is ${wa ? wa.status : 'missing'} — choose an approved template first` }
      }
    }
    const { error } = await supabase.from('automations').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteAutomation(id: string) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { error } = await supabase.from('automations').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function installTemplate(templateKey: string) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const template = AUTOMATION_TEMPLATES.find(t => t.template_key === templateKey)
    if (!template) return { success: false, error: 'Template not found' }

    // Check not already installed
    const { data: existing } = await supabase
      .from('automations')
      .select('id')
      .eq('template_key', templateKey)
      .eq('is_template', false)
      .limit(1)
      .maybeSingle()
    if (existing) return { success: false, error: 'This template is already installed' }

    const { error } = await supabase.from('automations').insert({
      ...template,
      is_template:  false,
      template_key: templateKey,
      created_by:   user.id,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')

    // Installed switched off. Say up front if its WhatsApp template can't be sent yet.
    const waName = template.action_type === 'send_whatsapp' ? template.action_payload.template_name : null
    if (waName) {
      const { data: wa } = await supabase.from('whatsapp_templates').select('status').eq('name', waName).maybeSingle()
      if (wa?.status !== 'approved') {
        return { success: true, warning: `Installed (off). WhatsApp template "${waName}" is ${wa ? wa.status : 'missing'} — pick an approved template before switching it on.` }
      }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
