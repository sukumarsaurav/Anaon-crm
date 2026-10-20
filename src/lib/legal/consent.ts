import { createServiceClient } from '@/lib/supabase/service'

/**
 * DPDP consent trail (CRM → Legal → Privacy). Plain module, written with the service role: it is
 * called from webhooks (WhatsApp STOP / START) as well as from staff actions. Never throws.
 */
export async function recordConsent(input: {
  entityType: 'lead' | 'client'
  entityId: string
  entityName?: string | null
  consentType: 'marketing_whatsapp' | 'marketing_email' | 'data_storage' | 'site_visit_photos'
  consented: boolean
  source: string
  ip?: string | null
}): Promise<void> {
  try {
    const { error } = await createServiceClient().from('consent_logs').insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_name: input.entityName ?? null,
      consent_type: input.consentType,
      consented: input.consented,
      source: input.source,
      ip_address: input.ip ?? null,
    })
    if (error) console.error('[consent] insert failed:', error.message)
  } catch (e) {
    console.error('[consent] insert failed:', e)
  }
}

/** STOP / START on WhatsApp is a marketing-consent change for every lead on that number. */
export async function recordWhatsAppConsent(leadIds: (string | null | undefined)[], optedOut: boolean): Promise<void> {
  const ids = [...new Set(leadIds.filter(Boolean))] as string[]
  if (!ids.length) return
  const { data: leads } = await createServiceClient().from('leads').select('id, full_name').in('id', ids)
  for (const l of leads ?? []) {
    await recordConsent({
      entityType: 'lead', entityId: l.id, entityName: l.full_name,
      consentType: 'marketing_whatsapp', consented: !optedOut, source: optedOut ? 'whatsapp:STOP' : 'whatsapp:START',
    })
  }
}
