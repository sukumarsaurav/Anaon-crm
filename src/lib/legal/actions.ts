'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import type { LegalDocumentType, DeletionRequestStatus } from '@/types/legal'

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

const isManager = (role: string) => ['admin', 'manager'].includes(role)

// ── RERA project details ──────────────────────────────────────────────────

export async function updateProjectRERA(projectId: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const disclosures: Record<string, string> = {}
  const carpetArea = formData.get('carpet_area_sqft')
  const fsi = formData.get('fsi_approved')
  const units = formData.get('total_approved_units')
  const extraDisclosureKey = formData.get('disclosure_key') as string
  const extraDisclosureVal = formData.get('disclosure_value') as string
  if (extraDisclosureKey && extraDisclosureVal) {
    disclosures[extraDisclosureKey] = extraDisclosureVal
  }

  const { error } = await auth.supabase.from('projects').update({
    rera_number:               formData.get('rera_number') as string || null,
    rera_registration_date:    formData.get('rera_registration_date') as string || null,
    rera_expiry_date:          formData.get('rera_expiry_date') as string || null,
    rera_authority_name:       formData.get('rera_authority_name') as string || null,
    rera_website_url:          formData.get('rera_website_url') as string || null,
    legal_contact:             formData.get('legal_contact') as string || null,
    carpet_area_sqft:          carpetArea ? parseFloat(carpetArea as string) : null,
    fsi_approved:              fsi ? parseFloat(fsi as string) : null,
    total_approved_units:      units ? parseInt(units as string, 10) : null,
    quarterly_report_due_date: formData.get('quarterly_report_due_date') as string || null,
    updated_at:                new Date().toISOString(),
  }).eq('id', projectId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/legal/${projectId}`)
  revalidatePath('/legal')
  return { success: true }
}

export async function markQuarterlyReportSubmitted(projectId: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  // Calculate next quarterly due date (3 months from now)
  const nextDue = new Date()
  nextDue.setMonth(nextDue.getMonth() + 3)

  const { error } = await auth.supabase.from('projects').update({
    quarterly_report_last_submitted: new Date().toISOString().split('T')[0],
    quarterly_report_due_date:       nextDue.toISOString().split('T')[0],
    updated_at:                      new Date().toISOString(),
  }).eq('id', projectId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/legal/${projectId}`)
  revalidatePath('/legal')
  return { success: true }
}

// ── Legal document templates ──────────────────────────────────────────────

export async function createLegalTemplate(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('legal_document_templates').insert({
    name:        formData.get('name') as string,
    type:        formData.get('type') as LegalDocumentType,
    description: formData.get('description') as string || null,
    file_url:    formData.get('file_url') as string || null,
    version:     formData.get('version') as string || '1.0',
    created_by:  auth.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/legal/documents')
  return { success: true }
}

export async function updateLegalTemplate(id: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('legal_document_templates').update({
    name:        formData.get('name') as string,
    type:        formData.get('type') as LegalDocumentType,
    description: formData.get('description') as string || null,
    file_url:    formData.get('file_url') as string || null,
    version:     formData.get('version') as string || '1.0',
    updated_at:  new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/legal/documents')
  return { success: true }
}

export async function toggleLegalTemplate(id: string, isActive: boolean) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('legal_document_templates')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/legal/documents')
  return { success: true }
}

// ── Data deletion requests ────────────────────────────────────────────────

export async function submitDeletionRequest(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { error } = await auth.supabase.from('data_deletion_requests').insert({
    requester_type:  formData.get('requester_type') as 'lead' | 'client',
    requester_id:    formData.get('requester_id') as string || null,
    requester_name:  formData.get('requester_name') as string,
    requester_phone: formData.get('requester_phone') as string || null,
    requester_email: formData.get('requester_email') as string || null,
    reason:          formData.get('reason') as string || null,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/legal/privacy')
  return { success: true }
}

export async function updateDeletionRequestStatus(
  id: string,
  status: DeletionRequestStatus,
  notes?: string,
) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const update: Record<string, unknown> = {
    status,
    processed_by: auth.userId,
  }
  if (notes) update.admin_notes = notes
  if (status === 'completed') {
    update.completed_at = new Date().toISOString()
    // Anonymize data if completed
    // Note: actual anonymization done here in production
  }

  const { data: req } = await auth.supabase
    .from('data_deletion_requests')
    .select('requester_type, requester_id')
    .eq('id', id)
    .single()

  const { error } = await auth.supabase.from('data_deletion_requests')
    .update(update)
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  // If completed, anonymize the requester's record
  if (status === 'completed' && req?.requester_id) {
    const anonymized = {
      full_name: '[Deleted]',
      phone:     null,
      email:     null,
      updated_at: new Date().toISOString(),
    }
    if (req.requester_type === 'lead') {
      await auth.supabase.from('leads').update({ ...anonymized, is_active: false }).eq('id', req.requester_id)
    } else if (req.requester_type === 'client') {
      await auth.supabase.from('clients').update(anonymized).eq('id', req.requester_id)
    }
  }

  revalidatePath('/legal/privacy')
  return { success: true }
}

// ── Consent logging ───────────────────────────────────────────────────────

export async function logConsent(
  entityType: 'lead' | 'client',
  entityId: string,
  entityName: string,
  consentType: string,
  consented: boolean,
  source: string = 'crm',
) {
  const supabase = await createClient()
  await supabase.from('consent_logs').insert({
    entity_type: entityType,
    entity_id:   entityId,
    entity_name: entityName,
    consent_type: consentType,
    consented,
    source,
  })
}
