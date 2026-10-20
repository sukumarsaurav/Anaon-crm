import { createServiceClient } from '@/lib/supabase/service'
import { scoreLead } from './scoreLead'
import { resolveAssignee } from './assignment'
import { fireAutomations } from '@/lib/automation/engine'
import { notifyUsers } from '@/lib/notifications/notify'
import type { Lead, LeadSource } from '@/types/leads'

export interface NormalizedLeadInput {
  full_name?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  locality?: string | null
  requirement?: string | null // free-text requirement/message → stored as first note
  property_type?: string | null
  budget_min?: number | null
  budget_max?: number | null
  configuration?: string | null
  source: LeadSource
  campaign_name?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  /** Meta ad-manager campaign ID: matches the lead to a marketing campaign exactly. */
  meta_campaign_id?: string | null
  ad_set_name?: string | null
  project_id?: string | null
  /** The channel partner who brought the lead (broker portal). */
  broker_id?: string | null
  /** When set, skip rule/round-robin resolution and assign to this member. */
  assignedToOverride?: string | null
  /**
   * What to do when an active lead with this phone already exists. 'log' (default)
   * records a repeat-inquiry activity; 'ignore' does nothing — for chat sources where
   * every message of an ongoing conversation would otherwise become an activity.
   */
  onDuplicate?: 'log' | 'ignore'
}

export interface IngestResult {
  ok: boolean
  id?: string
  duplicate?: boolean
  error?: string
}

/** The error ingestLead returns for a phone it cannot use — retrying will not fix it. */
export const INVALID_PHONE = 'Invalid or missing phone number'

/** Normalize an Indian mobile number to 10 digits, or null if unusable. */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

/**
 * Single entry point for inbound leads from any external source. Handles
 * normalization, phone-based de-duplication, auto-assignment, initial scoring,
 * activity logging, and automation firing.
 */
export async function ingestLead(input: NormalizedLeadInput): Promise<IngestResult> {
  const phone = normalizePhone(input.phone)
  if (!phone) return { ok: false, error: INVALID_PHONE }
  if (!input.full_name?.trim()) input.full_name = 'Unknown Lead'

  const supabase = createServiceClient()

  // De-dup: if an active lead with this phone exists, log a re-inquiry instead
  // of creating a duplicate record. Matched on the last 10 digits: older and hand-typed
  // leads are stored formatted ("+91-98100 01025"), new ones as bare digits.
  const { data: existing } = await supabase
    .from('leads')
    .select('id, assigned_to')
    .ilike('phone', `%${phone}`)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (input.onDuplicate === 'ignore') return { ok: true, id: existing.id, duplicate: true }
    await supabase.from('lead_activities').insert({
      lead_id: existing.id,
      type: 'system',
      notes: `Repeat inquiry received from ${input.source}${input.requirement ? `: "${input.requirement}"` : ''}`,
    })
    return { ok: true, id: existing.id, duplicate: true }
  }

  const assignedTo = input.assignedToOverride
    ?? (await resolveAssignee(supabase, {
      source: input.source,
      property_type: input.property_type ?? null,
      city: input.city ?? null,
      budget_min: input.budget_min ?? null,
      budget_max: input.budget_max ?? null,
    }))

  const leadPayload: Record<string, unknown> = {
    full_name: input.full_name.trim(),
    phone,
    email: input.email || null,
    city: input.city || null,
    locality: input.locality || null,
    property_type: input.property_type || null,
    budget_min: input.budget_min ?? null,
    budget_max: input.budget_max ?? null,
    configuration: input.configuration || null,
    source: input.source,
    utm_source: input.utm_source || input.source,
    utm_medium: input.utm_medium || null,
    utm_campaign: input.utm_campaign || null,
    campaign_name: input.campaign_name || null,
    meta_campaign_id: input.meta_campaign_id || null,
    ad_set_name: input.ad_set_name || null,
    project_id: input.project_id || null,
    broker_id: input.broker_id || null,
    assigned_to: assignedTo,
    stage: 'new_lead',
    whatsapp_opt_in: true,
  }

  const { score, temperature } = await scoreLead(supabase, leadPayload as Partial<Lead>, [])
  leadPayload.score = score
  leadPayload.temperature = temperature

  const { data: created, error } = await supabase
    .from('leads')
    .insert(leadPayload)
    .select('id')
    .single()

  if (error || !created) return { ok: false, error: error?.message ?? 'Insert failed' }

  await supabase.from('lead_activities').insert({
    lead_id: created.id,
    type: 'system',
    notes: input.requirement
      ? `Lead captured from ${input.source}: "${input.requirement}"`
      : `Lead captured from ${input.source}`,
  })

  // Nobody was told about leads arriving from ads, WhatsApp, the website or brokers.
  if (assignedTo) {
    await notifyUsers([assignedTo], {
      title: 'New Lead Assigned',
      message: `${leadPayload.full_name as string} (${input.source.replace(/_/g, ' ')}) has been assigned to you.`,
      type: 'lead_assigned', related_type: 'lead', related_id: created.id, action_url: `/leads/${created.id}`,
    })
  }

  fireAutomations(
    'lead_created',
    {
      lead: {
        id: created.id,
        full_name: leadPayload.full_name as string,
        phone,
        source: input.source,
        stage: 'new_lead',
        assigned_to: assignedTo,
        project_id: input.project_id ?? null,
        utm_source: (leadPayload.utm_source as string) ?? null,
      },
    },
    'lead',
    created.id,
  )

  return { ok: true, id: created.id }
}
