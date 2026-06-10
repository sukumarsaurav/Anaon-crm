'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { fireAutomations } from '@/lib/automation/engine'
import { STAGE_ORDER } from '@/types/leads'
import type { LeadStage } from '@/types/leads'

/** Advance a lead's stage only forward (never move it backward in the pipeline). */
async function advanceStageForward(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  currentStage: LeadStage,
  target: LeadStage,
  userId: string,
) {
  if (STAGE_ORDER.indexOf(currentStage) >= STAGE_ORDER.indexOf(target)) return
  await supabase.from('leads').update({ stage: target, updated_at: new Date().toISOString() }).eq('id', leadId)
  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'stage_change',
    stage_from: currentStage,
    stage_to: target,
    notes: `Stage changed from ${currentStage} to ${target}`,
    performed_by: userId,
  })
}

export async function scheduleSiteVisit(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const leadId = formData.get('lead_id') as string
  const scheduledAt = formData.get('scheduled_at') as string
  if (!leadId || !scheduledAt) return { success: false, error: 'Lead and date/time are required' }

  const projectId = (formData.get('project_id') as string) || null
  const accompaniedBy = (formData.get('accompanied_by') as string) || user.id
  const preVisitNote = (formData.get('advisor_notes') as string) || null

  const { data: lead } = await supabase
    .from('leads')
    .select('stage, full_name, phone, assigned_to, project_id, utm_source')
    .eq('id', leadId)
    .single()
  if (!lead) return { success: false, error: 'Lead not found' }

  const { error } = await supabase.from('site_visits').insert({
    lead_id: leadId,
    project_id: projectId ?? lead.project_id ?? null,
    scheduled_at: scheduledAt,
    accompanied_by: accompaniedBy,
    advisor_notes: preVisitNote,
    status: 'scheduled',
  })
  if (error) return { success: false, error: error.message }

  // Advance pipeline + surface in the follow-up system at the visit time.
  await advanceStageForward(supabase, leadId, lead.stage as LeadStage, 'site_visit_scheduled', user.id)
  await supabase
    .from('leads')
    .update({ next_followup_at: scheduledAt, followup_reminder_sent_at: null })
    .eq('id', leadId)

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'site_visit',
    scheduled_at: scheduledAt,
    notes: preVisitNote ? `Site visit scheduled — ${preVisitNote}` : 'Site visit scheduled',
    performed_by: user.id,
  })

  fireAutomations(
    'site_visit_scheduled',
    {
      lead: {
        id: leadId,
        full_name: lead.full_name,
        phone: lead.phone,
        stage: 'site_visit_scheduled',
        assigned_to: lead.assigned_to,
        project_id: projectId ?? lead.project_id ?? null,
        utm_source: lead.utm_source,
      },
    },
    'lead',
    leadId,
  )

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function recordSiteVisitOutcome(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const visitId = formData.get('visit_id') as string
  const leadId = formData.get('lead_id') as string
  const status = formData.get('status') as 'completed' | 'no_show' | 'cancelled'
  if (!visitId || !leadId || !status) return { success: false, error: 'Missing fields' }

  const feedback = (formData.get('client_feedback') as string) || null
  const followupAt = (formData.get('followup_at') as string) || null

  const { error } = await supabase
    .from('site_visits')
    .update({
      status,
      visited_at: status === 'completed' ? new Date().toISOString() : null,
      visited_by: status === 'completed' ? user.id : null,
      client_feedback: feedback,
    })
    .eq('id', visitId)
  if (error) return { success: false, error: error.message }

  const { data: lead } = await supabase
    .from('leads')
    .select('stage, full_name, phone, assigned_to, project_id, utm_source')
    .eq('id', leadId)
    .single()
  if (!lead) return { success: false, error: 'Lead not found' }

  if (status === 'completed') {
    await advanceStageForward(supabase, leadId, lead.stage as LeadStage, 'site_visit_done', user.id)
  }

  // Schedule the next follow-up so the lead never goes idle after a visit.
  const leadUpdates: Record<string, unknown> = {}
  if (followupAt) {
    leadUpdates.next_followup_at = followupAt
    leadUpdates.followup_reminder_sent_at = null
  }
  if (Object.keys(leadUpdates).length) {
    await supabase.from('leads').update(leadUpdates).eq('id', leadId)
  }

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'site_visit',
    outcome: null,
    notes:
      status === 'completed'
        ? `Site visit completed.${feedback ? ` Feedback: "${feedback}"` : ''}`
        : `Site visit ${status === 'no_show' ? 'no-show' : 'cancelled'}.${feedback ? ` Note: "${feedback}"` : ''}`,
    performed_by: user.id,
  })

  if (status === 'completed') {
    fireAutomations(
      'site_visit_completed',
      {
        lead: {
          id: leadId,
          full_name: lead.full_name,
          phone: lead.phone,
          stage: 'site_visit_done',
          assigned_to: lead.assigned_to,
          project_id: lead.project_id,
          utm_source: lead.utm_source,
        },
      },
      'lead',
      leadId,
    )
  }

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}
