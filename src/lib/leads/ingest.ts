import { createServiceClient } from '@/lib/supabase/service'
import { calculateLeadScore } from './scoring'
import { resolveAssignee } from './assignment'
import { fireAutomations } from '@/lib/automation/engine'
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
  /** When set, skip rule/round-robin resolution and assign to this member. */
  assignedToOverride?: string | null
}

export interface IngestResult {
  ok: boolean
  id?: string
  duplicate?: boolean
  error?: string
}

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
  if (!phone) return { ok: false, error: 'Invalid or missing phone number' }
  if (!input.full_name?.trim()) input.full_name = 'Unknown Lead'

  const supabase = createServiceClient()

  // De-dup: if an active lead with this phone exists, log a re-inquiry instead
  // of creating a duplicate record.
  const { data: existing } = await supabase
    .from('leads')
    .select('id, assigned_to')
    .eq('phone', phone)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
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
    assigned_to: assignedTo,
    stage: 'new_lead',
    whatsapp_opt_in: true,
  }

  const { score, temperature } = calculateLeadScore({
    lead: leadPayload as Partial<Lead>,
    activities: [],
  })
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
        project_id: null,
        utm_source: (leadPayload.utm_source as string) ?? null,
      },
    },
    'lead',
    created.id,
  )

  return { ok: true, id: created.id }
}
