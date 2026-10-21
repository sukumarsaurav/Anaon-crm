'use server'

import { todayIST } from '@/lib/datetime'
import { revalidatePath } from 'next/cache'
import { recordConsent } from './consent'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { eraseSubject } from '@/lib/legal/erasure'
import type { LegalDocumentType, DeletionRequestStatus } from '@/types/legal'
import { searchOr } from '@/lib/supabase/search'
import { writeAuditLog } from '@/lib/security/audit'
import { nextQuarterlyDue } from './rera'

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

  const carpetArea = formData.get('carpet_area_sqft')
  const fsi = formData.get('fsi_approved')
  const units = formData.get('total_approved_units')
  const expiry = (formData.get('rera_expiry_date') as string) || null
  const registered = (formData.get('rera_registration_date') as string) || null
  if (expiry && registered && expiry <= registered) return { success: false, error: 'The expiry date must be after the registration date' }
  const website = (formData.get('rera_website_url') as string)?.trim() || null
  if (website && !/^https?:\/\//i.test(website)) return { success: false, error: 'The RERA website must start with http:// or https://' }

  // Extra disclosure (key → value). It was parsed and then never saved.
  const extraKey = (formData.get('disclosure_key') as string)?.trim()
  const extraVal = (formData.get('disclosure_value') as string)?.trim()
  let disclosures: Record<string, string> | undefined
  if (extraKey && extraVal) {
    const { data: current } = await auth.supabase.from('projects').select('rera_disclosures').eq('id', projectId).maybeSingle()
    disclosures = { ...((current?.rera_disclosures as Record<string, string> | null) ?? {}), [extraKey]: extraVal }
  }

  const { error } = await auth.supabase.from('projects').update({
    rera_number:               formData.get('rera_number') as string || null,
    rera_registration_date:    registered,
    rera_expiry_date:          expiry,
    rera_authority_name:       formData.get('rera_authority_name') as string || null,
    rera_website_url:          website,
    legal_contact:             formData.get('legal_contact') as string || null,
    carpet_area_sqft:          carpetArea ? parseFloat(carpetArea as string) : null,
    fsi_approved:              fsi ? parseFloat(fsi as string) : null,
    total_approved_units:      units ? parseInt(units as string, 10) : null,
    quarterly_report_due_date: formData.get('quarterly_report_due_date') as string || null,
    ...(disclosures ? { rera_disclosures: disclosures } : {}),
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

  const { error } = await auth.supabase.from('projects').update({
    quarterly_report_last_submitted: todayIST(),
    quarterly_report_due_date:       nextQuarterlyDue(todayIST()),
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

/** Lead / client picker for a deletion request (the request must point at a record to be erasable). */
export async function searchErasureSubjects(type: 'lead' | 'client', term: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return []
  const or = searchOr(term, { text: ['full_name', 'email'], phone: ['phone'] })
  if (!or) return []
  const { data } = await auth.supabase
    .from(type === 'lead' ? 'leads' : 'clients')
    .select('id, full_name, phone, email')
    .or(or)
    .neq('full_name', '[Deleted]')
    .order('full_name')
    .limit(8)
  return (data ?? []) as { id: string; full_name: string; phone: string | null; email: string | null }[]
}

export async function submitDeletionRequest(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const requesterType = formData.get('requester_type') as string
  if (requesterType !== 'lead' && requesterType !== 'client') return { success: false, error: 'Choose lead or client' }
  const requesterId = (formData.get('requester_id') as string) || null
  const name = (formData.get('requester_name') as string)?.trim()
  if (!name) return { success: false, error: 'Enter the requester’s name' }
  // Without a linked record "Mark completed" can never erase anything; check it exists now.
  if (!requesterId) return { success: false, error: `Find and select the ${requesterType} the request is about` }
  const { data: subject } = await auth.supabase.from(requesterType === 'lead' ? 'leads' : 'clients').select('id').eq('id', requesterId).maybeSingle()
  if (!subject) return { success: false, error: `That ${requesterType} was not found` }

  const { error } = await auth.supabase.from('data_deletion_requests').insert({
    requester_type:  requesterType,
    requester_id:    requesterId,
    requester_name:  name,
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
  if (status === 'completed' || status === 'rejected') update.completed_at = new Date().toISOString()

  const { data: req } = await auth.supabase
    .from('data_deletion_requests')
    .select('requester_type, requester_id')
    .eq('id', id)
    .single()

  // Erase first and only mark the request completed if every step worked, so a failure
  // can be retried instead of being recorded as done.
  if (status === 'completed') {
    if (!req?.requester_id || (req.requester_type !== 'lead' && req.requester_type !== 'client')) {
      return { success: false, error: 'This request is not linked to a lead or client record, so nothing can be erased automatically.' }
    }
    const result = await eraseSubject(req.requester_type, req.requester_id)
    if (!result.ok) {
      return { success: false, error: `Erasure incomplete — request left open. ${result.errors.join('; ')}` }
    }
    update.completed_at = new Date().toISOString()
    update.admin_notes = [notes, `Erased: ${result.summary.join('; ')}`].filter(Boolean).join('\n')
  }

  if (status === 'rejected' && !notes?.trim()) return { success: false, error: 'Add a note saying why the request is rejected' }

  const { error } = await auth.supabase.from('data_deletion_requests')
    .update(update)
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  if (status === 'completed') {
    await writeAuditLog({ userId: auth.userId, action: 'data_erased', tableName: req?.requester_type === 'client' ? 'clients' : 'leads', recordId: req?.requester_id ?? undefined, metadata: { request_id: id } })
  }

  revalidatePath('/legal/privacy')
  return { success: true }
}

// ── Consent logging ───────────────────────────────────────────────────────

export async function logConsent(
  entityType: 'lead' | 'client',
  entityId: string,
  entityName: string,
  consentType: 'marketing_whatsapp' | 'marketing_email' | 'data_storage' | 'site_visit_photos',
  consented: boolean,
  source: string = 'crm',
) {
  const auth = await getAuth()
  if (!auth.ok || !['admin', 'manager', 'sales_advisor', 'telecaller'].includes(auth.role)) return { success: false, error: 'Unauthorized' }
  await recordConsent({ entityType, entityId, entityName, consentType, consented, source })
  revalidatePath('/legal/privacy')
  return { success: true }
}
