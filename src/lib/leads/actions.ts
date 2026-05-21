'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculateLeadScore } from './scoring'
import { getRoundRobinAdvisor, getLeadActivities } from './queries'
import type { LeadStage, FollowUpOutcome, Lead } from '@/types/leads'
import { suggestNextFollowup } from '@/lib/utils'
import { fireAutomations } from '@/lib/automation/engine'

export async function createLead(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

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

  // Auto-assign via round-robin
  const assignedTo = formData.get('assigned_to') as string | null
  if (assignedTo) {
    payload.assigned_to = assignedTo
  } else {
    const advisorId = await getRoundRobinAdvisor(profile?.branch_id ?? undefined)
    payload.assigned_to = advisorId
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
  const { data: { user } } = await supabase.auth.getUser()
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
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: lead } = await supabase.from('leads').select('stage, score').eq('id', leadId).single()
  if (!lead) return { success: false, error: 'Lead not found' }

  const oldStage = lead.stage as LeadStage

  const activities = await getLeadActivities(leadId)
  const { score, temperature } = calculateLeadScore({
    lead: { ...lead, stage: newStage },
    activities,
  })

  const { error } = await supabase
    .from('leads')
    .update({
      stage: newStage,
      score,
      temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) return { success: false, error: error.message }

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'stage_change',
    stage_from: oldStage,
    stage_to: newStage,
    notes: notes ?? `Stage changed from ${oldStage} to ${newStage}`,
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
  const { data: { user } } = await supabase.auth.getUser()
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
  } else if (outcome === 'not_reachable' || outcome === 'callback_requested') {
    updates.next_followup_at = suggestNextFollowup(outcome).toISOString()
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
  const { data: { user } } = await supabase.auth.getUser()
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

  // Notify new advisor
  await supabase.from('notifications').insert({
    user_id: advisorId,
    title: 'New Lead Assigned',
    body: 'A lead has been assigned to you.',
    type: 'lead_assigned',
    related_record_type: 'lead',
    related_record_id: leadId,
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: advisorId, updated_at: new Date().toISOString() })
    .in('id', leadIds)

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true }
}

export async function deleteLead(leadId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('leads')
    .update({ next_followup_at: followupAt, updated_at: new Date().toISOString() })
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Mark merged lead as duplicate, link to kept lead
  const { error } = await supabase
    .from('leads')
    .update({
      is_active: false,
      is_duplicate: true,
      duplicate_of: keepLeadId,
    })
    .eq('id', mergeLeadId)

  if (error) return { success: false, error: error.message }

  await supabase.from('lead_activities').insert({
    lead_id: keepLeadId,
    type: 'system',
    notes: `Duplicate lead (${mergeLeadId}) merged into this record`,
    performed_by: user.id,
  })

  revalidatePath('/leads')
  revalidatePath(`/leads/${keepLeadId}`)
  return { success: true }
}
