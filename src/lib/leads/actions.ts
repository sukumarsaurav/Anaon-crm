'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { calculateLeadScore } from './scoring'
import { getLeadActivities } from './queries'
import { resolveAssignee } from './assignment'
import { notifyUsers } from '@/lib/notifications/notify'
import { sendWhatsAppText, sendWhatsAppTemplate, isWhatsAppOptedOut, recordOutboundWhatsApp } from '@/lib/whatsapp/send'
import { fillTemplateVariables } from '@/lib/whatsapp/variables'
import { renderTemplate } from '@/lib/whatsapp/template-render'
import type { LeadStage, FollowUpOutcome, Lead } from '@/types/leads'
import { suggestNextFollowup } from '@/lib/utils'
import { fireAutomations } from '@/lib/automation/engine'

export async function createLead(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient()
  const session = await getProfile()
  const user = session?.user
  if (!user) return { success: false, error: 'Not authenticated' }
  const profile = session?.profile

  const payload: Record<string, unknown> = {
    full_name: formData.get('full_name'),
    phone: (formData.get('phone') as string)?.replace(/\s/g, ''),
    alternate_phone: formData.get('alternate_phone') || null,
    email: formData.get('email') || null,
    city: formData.get('city') || null,
    locality: formData.get('locality') || null,
    project_id: formData.get('project_id') || null,
    property_type: formData.get('property_type') || null,
    budget_min: formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
    budget_max: formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
    configuration: formData.get('configuration') || null,
    purpose: formData.get('purpose') || null,
    timeline: formData.get('timeline') || null,
    source: formData.get('source') || 'manual',
    utm_source: formData.get('utm_source') || null,
    utm_medium: formData.get('utm_medium') || null,
    utm_campaign: formData.get('utm_campaign') || null,
    utm_term: formData.get('utm_term') || null,
    utm_content: formData.get('utm_content') || null,
    campaign_name: formData.get('campaign_name') || null,
    preferred_contact_time: formData.get('preferred_contact_time') || null,
    preferred_contact_method: formData.get('preferred_contact_method') || null,
    stage: 'new_lead',
    score: 0,
    temperature: 'cold',
    branch_id: profile?.branch_id ?? null,
    created_by: user.id,
  }

  // Auto-assign via assignment rules (falls back to round-robin)
  const assignedTo = formData.get('assigned_to') as string | null
  if (assignedTo) {
    payload.assigned_to = assignedTo
  } else {
    payload.assigned_to = await resolveAssignee(supabase, {
      source: payload.source as string | null,
      property_type: payload.property_type as string | null,
      city: payload.city as string | null,
      budget_min: payload.budget_min as number | null,
      budget_max: payload.budget_max as number | null,
      branch_id: payload.branch_id as string | null,
    })
  }

  // Initial scoring
  const { score, temperature } = calculateLeadScore({
    lead: payload as Partial<Lead>,
    activities: [],
  })
  payload.score = score
  payload.temperature = temperature

  const { data, error } = await supabase.from('leads').insert(payload).select('id').single()
  if (error) return { success: false, error: error.message }

  // Log system activity
  await supabase.from('lead_activities').insert({
    lead_id: data.id,
    type: 'system',
    notes: `Lead created from ${payload.source}`,
    performed_by: user.id,
  })

  // Fire automations
  fireAutomations('lead_created', {
    lead: {
      id: data.id,
      full_name: payload.full_name as string,
      phone: payload.phone as string,
      source: payload.source as string,
      stage: 'new_lead',
      assigned_to: payload.assigned_to as string | null ?? null,
      project_id: payload.project_id as string | null ?? null,
      utm_source: payload.utm_source as string | null ?? null,
    },
  }, 'lead', data.id)

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    table_name: 'leads',
    record_id: data.id,
    new_values: payload,
  })

  revalidatePath('/leads')
  return { success: true, id: data.id }
}

export async function updateLead(
  id: string,
  updates: Partial<Lead>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: oldLead } = await supabase.from('leads').select('*').eq('id', id).single()

  const activities = await getLeadActivities(id)
  const { score, temperature } = calculateLeadScore({
    lead: { ...oldLead, ...updates },
    activities,
  })

  const { error } = await supabase
    .from('leads')
    .update({ ...updates, score, temperature, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    table_name: 'leads',
    record_id: id,
    old_values: oldLead,
    new_values: updates,
  })

  revalidatePath(`/leads/${id}`)
  revalidatePath('/leads')
  return { success: true }
}

export async function changeLeadStage(
  leadId: string,
  newStage: LeadStage,
  notes?: string,
  lossReason?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: lead } = await supabase.from('leads').select('stage, score').eq('id', leadId).single()
  if (!lead) return { success: false, error: 'Lead not found' }

  const oldStage = lead.stage as LeadStage

  const activities = await getLeadActivities(leadId)
  const { score, temperature } = calculateLeadScore({
    lead: { ...lead, stage: newStage },
    activities,
  })

  const updates: Record<string, unknown> = {
    stage: newStage,
    score,
    temperature,
    updated_at: new Date().toISOString(),
  }
  // Persist loss reason only when marking not interested; clear it otherwise.
  if (newStage === 'not_interested') {
    if (lossReason) updates.loss_reason = lossReason
  } else {
    updates.loss_reason = null
  }

  const { error } = await supabase.from('leads').update(updates).eq('id', leadId)

  if (error) return { success: false, error: error.message }

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'stage_change',
    stage_from: oldStage,
    stage_to: newStage,
    notes:
      notes ??
      (newStage === 'not_interested' && lossReason
        ? `Marked Not Interested — ${lossReason}`
        : `Stage changed from ${oldStage} to ${newStage}`),
    performed_by: user.id,
  })

  // Fire automation after fetching lead context
  const { data: updatedLead } = await supabase.from('leads').select('full_name, phone, assigned_to, project_id, utm_source').eq('id', leadId).single()
  if (updatedLead) {
    fireAutomations('lead_stage_changed', {
      lead: { id: leadId, full_name: updatedLead.full_name, phone: updatedLead.phone, stage: newStage, assigned_to: updatedLead.assigned_to, project_id: updatedLead.project_id, utm_source: updatedLead.utm_source },
    }, 'lead', leadId)
  }

  revalidatePath(`/leads/${leadId}`)
  revalidatePath('/leads')
  return { success: true }
}

export async function logActivity(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const leadId = formData.get('lead_id') as string
  const type = formData.get('type') as string
  const outcome = formData.get('outcome') as FollowUpOutcome | null
  const notes = formData.get('notes') as string
  const durationSec = formData.get('duration_seconds')
  const scheduleFollowup = formData.get('schedule_followup') === 'true'
  const followupAt = formData.get('followup_at') as string | null

  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type,
    outcome: outcome || null,
    notes: notes || null,
    call_duration_seconds: durationSec ? Number(durationSec) : null,
    performed_by: user.id,
  })

  if (error) return { success: false, error: error.message }

  // Update lead: last contacted, follow-up count, next followup
  const updates: Record<string, unknown> = {
    last_contacted_at: new Date().toISOString(),
    follow_up_count: supabase.rpc('increment', { table: 'leads', id: leadId, column: 'follow_up_count' }),
  }

  if (scheduleFollowup && followupAt) {
    updates.next_followup_at = followupAt
    updates.followup_reminder_sent_at = null
  } else if (outcome === 'not_reachable' || outcome === 'callback_requested') {
    updates.next_followup_at = suggestNextFollowup(outcome).toISOString()
    updates.followup_reminder_sent_at = null
  }

  await supabase.from('leads').update(updates).eq('id', leadId)

  // Re-score
  const activities = await getLeadActivities(leadId)
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (lead) {
    const { score, temperature } = calculateLeadScore({ lead, activities })
    await supabase.from('leads').update({ score, temperature }).eq('id', leadId)
  }

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function assignLead(
  leadId: string,
  advisorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: oldLead } = await supabase.from('leads').select('assigned_to').eq('id', leadId).single()

  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: advisorId, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { success: false, error: error.message }

  const { data: newAdvisor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', advisorId)
    .single()

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'assignment',
    notes: `Lead assigned to ${newAdvisor?.full_name}`,
    performed_by: user.id,
  })

  // Notify new advisor (in-app + push)
  await notifyUsers([advisorId], {
    title: 'New Lead Assigned',
    message: 'A lead has been assigned to you.',
    type: 'lead_assigned',
    related_type: 'lead',
    related_id: leadId,
    action_url: `/leads/${leadId}`,
  })

  const { data: assignedLead } = await supabase.from('leads').select('full_name, phone, stage, project_id, utm_source').eq('id', leadId).single()
  if (assignedLead) {
    fireAutomations('lead_assigned', {
      lead: { id: leadId, full_name: assignedLead.full_name, phone: assignedLead.phone, stage: assignedLead.stage, assigned_to: advisorId, project_id: assignedLead.project_id, utm_source: assignedLead.utm_source },
      advisor: { id: advisorId, full_name: newAdvisor?.full_name ?? '' },
    }, 'lead', leadId)
  }

  revalidatePath(`/leads/${leadId}`)
  revalidatePath('/leads')
  return { success: true }
}

export async function bulkAssignLeads(
  leadIds: string[],
  advisorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: advisorId, updated_at: new Date().toISOString() })
    .in('id', leadIds)

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true }
}

export async function bulkChangeStage(
  leadIds: string[],
  stage: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!leadIds.length) return { success: false, error: 'No leads selected' }

  const { error } = await supabase
    .from('leads')
    .update({ stage, updated_at: new Date().toISOString() })
    .in('id', leadIds)
  if (error) return { success: false, error: error.message }

  // One timeline entry per lead recording the bulk change.
  await supabase.from('lead_activities').insert(
    leadIds.map((lead_id) => ({
      lead_id,
      type: 'stage_change',
      notes: `Stage changed to "${stage.replace(/_/g, ' ')}" (bulk action)`,
      performed_by: user.id,
    }))
  )

  revalidatePath('/leads')
  return { success: true, count: leadIds.length }
}

/**
 * WhatsApp to selected leads. A template reaches anyone; free text only reaches leads who
 * messaged in the last 24 hours (WhatsApp's rule) — the rest come back as failed with
 * that reason rather than silently.
 */
export async function bulkSendWhatsApp(
  leadIds: string[],
  message: string,
  templateId?: string | null,
): Promise<{ success: boolean; error?: string; sent?: number; failed?: number; errors?: string[] }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!leadIds.length) return { success: false, error: 'No leads selected' }
  if (leadIds.length > 200) return { success: false, error: 'Send to at most 200 leads at once — use a Broadcast for more' }
  if (!templateId && !message.trim()) return { success: false, error: 'Message is empty' }

  type Tpl = { name: string; language: string; body: string; variable_names: string[] }
  let template: Tpl | null = null
  if (templateId) {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('name, language, body, variable_names, status')
      .eq('id', templateId)
      .single()
    if (!data || data.status !== 'approved') return { success: false, error: 'Template is not approved' }
    template = data as Tpl
  }

  // RLS: only leads this user can see.
  const { data: leads } = await supabase
    .from('leads')
    .select('id, full_name, phone, project:projects(name)')
    .in('id', leadIds)
    .not('phone', 'is', null)

  const profile = (await getProfile())?.profile
  let sent = 0
  let failed = 0
  const errors: string[] = []
  for (const lead of leads ?? []) {
    if (await isWhatsAppOptedOut(lead.phone as string)) {
      failed++
      errors.push(`${lead.full_name}: opted out`)
      continue
    }
    let res
    let body: string
    if (template) {
      const { values, missing } = fillTemplateVariables(template.variable_names, {
        name: lead.full_name || 'there',
        project: (lead.project as unknown as { name?: string } | null)?.name,
        advisor_name: profile?.full_name,
      })
      if (missing.length) {
        failed++
        errors.push(`${lead.full_name}: no value for ${missing.join(', ')}`)
        continue
      }
      const vars = Object.fromEntries(template.variable_names.map((n, i) => [n, values[i]]))
      body = renderTemplate(template.body, template.variable_names, vars)
      res = await sendWhatsAppTemplate({ to: lead.phone as string, name: template.name, language: template.language, variables: values })
      if (res.success) {
        await recordOutboundWhatsApp({ to: res.to!, body, type: 'template', waMessageId: res.messageId, templateName: template.name, templateParams: vars, sentBy: user.id, leadId: lead.id })
      }
    } else {
      body = message.replace(/\{\{\s*name\s*\}\}/g, lead.full_name ?? 'there')
      res = await sendWhatsAppText({ to: lead.phone as string, text: body })
      if (res.success) {
        await recordOutboundWhatsApp({ to: res.to!, body, type: 'text', waMessageId: res.messageId, sentBy: user.id, leadId: lead.id })
      }
    }
    if (res.success) {
      sent++
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        type: 'whatsapp',
        notes: `WhatsApp sent (bulk): ${body.slice(0, 120)}`,
        performed_by: user.id,
      })
    } else {
      failed++
      errors.push(`${lead.full_name}: ${res.error}`)
    }
  }

  revalidatePath('/leads')
  return { success: true, sent, failed, errors: errors.slice(0, 10) }
}

export async function deleteLead(leadId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const profile = (await getProfile())?.profile
  if (profile?.role !== 'admin') return { success: false, error: 'Only admins can delete leads' }

  // Soft delete
  const { error } = await supabase.from('leads').update({ is_active: false }).eq('id', leadId)
  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    table_name: 'leads',
    record_id: leadId,
  })

  revalidatePath('/leads')
  return { success: true }
}

export async function scheduleFollowUp(
  leadId: string,
  followupAt: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('leads')
    .update({ next_followup_at: followupAt, followup_reminder_sent_at: null, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/leads/${leadId}`)
  revalidatePath('/leads')
  return { success: true }
}

export async function mergeDuplicate(
  keepLeadId: string,
  mergeLeadId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const profile = (await getProfile())?.profile
  if (!['admin', 'manager'].includes(profile?.role ?? '')) {
    return { success: false, error: 'Only admins and managers can merge leads' }
  }
  if (keepLeadId === mergeLeadId) return { success: false, error: 'Cannot merge a lead into itself' }

  // Pull both records so we can backfill empty fields on the survivor and keep
  // the higher score.
  const { data: pair } = await supabase
    .from('leads')
    .select('id, full_name, email, phone, alternate_phone, city, budget_min, budget_max, score, project_id')
    .in('id', [keepLeadId, mergeLeadId])

  const keep = pair?.find((l) => l.id === keepLeadId)
  const dupe = pair?.find((l) => l.id === mergeLeadId)
  if (!keep || !dupe) return { success: false, error: 'One or both leads not found' }

  // Re-parent child records from the duplicate onto the survivor.
  await Promise.all([
    supabase.from('lead_activities').update({ lead_id: keepLeadId }).eq('lead_id', mergeLeadId),
    supabase.from('site_visits').update({ lead_id: keepLeadId }).eq('lead_id', mergeLeadId),
    supabase.from('clients').update({ lead_id: keepLeadId }).eq('lead_id', mergeLeadId),
  ])

  // Backfill survivor fields that are empty, and keep the higher score.
  const backfill: Record<string, unknown> = {}
  const fillable = ['email', 'alternate_phone', 'city', 'budget_min', 'budget_max', 'project_id'] as const
  for (const f of fillable) {
    if ((keep as Record<string, unknown>)[f] == null && (dupe as Record<string, unknown>)[f] != null) {
      backfill[f] = (dupe as Record<string, unknown>)[f]
    }
  }
  const keepScore = Math.max(Number(keep.score ?? 0), Number(dupe.score ?? 0))
  if (keepScore !== Number(keep.score ?? 0)) backfill.score = keepScore
  if (Object.keys(backfill).length) {
    backfill.updated_at = new Date().toISOString()
    await supabase.from('leads').update(backfill).eq('id', keepLeadId)
  }

  // Retire the duplicate.
  const { error } = await supabase
    .from('leads')
    .update({ is_active: false, is_duplicate: true, duplicate_of: keepLeadId, updated_at: new Date().toISOString() })
    .eq('id', mergeLeadId)
  if (error) return { success: false, error: error.message }

  await supabase.from('lead_activities').insert({
    lead_id: keepLeadId,
    type: 'system',
    notes: `Merged duplicate lead "${dupe.full_name}" (${dupe.phone}) into this record — its activities and site visits were moved here.`,
    performed_by: user.id,
  })

  revalidatePath('/leads')
  revalidatePath(`/leads/${keepLeadId}`)
  return { success: true }
}
