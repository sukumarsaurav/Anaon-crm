'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { AUTOMATION_TEMPLATES } from '@/types/automation'
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
  if (actionType === 'send_email' && !p.email_body?.trim()) return 'Write the email body'
  if (actionType === 'change_lead_stage' && !p.new_stage) return 'Choose the new stage'
  return null
}

export async function createAutomation(formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const conditionsRaw = formData.get('conditions') as string
    const payloadRaw = formData.get('action_payload') as string
    const conditions: AutomationCondition[] = conditionsRaw ? JSON.parse(conditionsRaw) : []
    const action_payload: AutomationActionPayload = payloadRaw ? JSON.parse(payloadRaw) : {}
    const problem = payloadProblem(formData.get('action_type') as string, action_payload)
    if (problem) return { success: false, error: problem }

    const { error } = await supabase.from('automations').insert({
      name:          formData.get('name') as string,
      description:   (formData.get('description') as string) || null,
      trigger_event: formData.get('trigger_event') as TriggerEvent,
      conditions,
      delay_value:   parseInt(formData.get('delay_value') as string) || 0,
      delay_unit:    (formData.get('delay_unit') as DelayUnit) || 'minutes',
      action_type:   formData.get('action_type') as ActionType,
      action_payload,
      is_active:     formData.get('is_active') === 'true',
      is_template:   false,
      created_by:    user.id,
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

    const conditionsRaw = formData.get('conditions') as string
    const payloadRaw = formData.get('action_payload') as string
    const problem = payloadProblem(formData.get('action_type') as string, payloadRaw ? JSON.parse(payloadRaw) : {})
    if (problem) return { success: false, error: problem }

    const { error } = await supabase.from('automations').update({
      name:          formData.get('name') as string,
      description:   (formData.get('description') as string) || null,
      trigger_event: formData.get('trigger_event') as TriggerEvent,
      conditions:    conditionsRaw ? JSON.parse(conditionsRaw) : [],
      delay_value:   parseInt(formData.get('delay_value') as string) || 0,
      delay_unit:    (formData.get('delay_unit') as DelayUnit) || 'minutes',
      action_type:   formData.get('action_type') as ActionType,
      action_payload: payloadRaw ? JSON.parse(payloadRaw) : {},
      updated_at:    new Date().toISOString(),
    }).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleAutomation(id: string, isActive: boolean) {
  try {
    await getAuthUser()
    const supabase = await createClient()
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
      .single()
    if (existing) return { success: false, error: 'This template is already installed' }

    const { error } = await supabase.from('automations').insert({
      ...template,
      is_template:  false,
      template_key: templateKey,
      created_by:   user.id,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
