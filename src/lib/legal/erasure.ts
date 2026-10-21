import { createServiceClient } from '@/lib/supabase/service'
import { lastTenDigits } from '@/lib/whatsapp/phone'
import { FILES_BUCKET, filePathFromUrl } from '@/lib/files/storage'

/**
 * DPDP erasure. Plain module (service client, no 'use server'): never callable from the browser.
 *
 * Personal identifiers are removed or replaced; financial records (bookings, payments, receipts)
 * are kept because RERA / tax law requires them, but no longer point at a named person.
 * Every step is checked: the caller must not mark a request "completed" if anything failed.
 * (The previous version set NOT NULL phone columns to null, so its update always failed
 * silently and nothing was ever erased.)
 */

const DELETED = '[Deleted]'
const WA_BUCKET = 'whatsapp-media'

export interface ErasureResult {
  ok: boolean
  errors: string[]
  summary: string[]
}

export async function eraseSubject(type: 'lead' | 'client', id: string): Promise<ErasureResult> {
  const svc = createServiceClient()
  const errors: string[] = []
  const summary: string[] = []
  const now = new Date().toISOString()

  const check = (label: string, error: { message: string } | null | undefined, done?: string) => {
    if (error) errors.push(`${label}: ${error.message}`)
    else if (done) summary.push(done)
  }

  // Everything that can identify the person across tables: their phones and linked ids.
  let phones: string[] = []
  let leadIds: string[] = []
  let clientIds: string[] = []

  if (type === 'lead') {
    const { data } = await svc.from('leads').select('phone, alternate_phone').eq('id', id).maybeSingle()
    if (!data) return { ok: false, errors: ['Lead not found'], summary }
    phones = [data.phone, data.alternate_phone].filter(Boolean) as string[]
    leadIds = [id]
    const { data: linked } = await svc.from('clients').select('id').eq('lead_id', id)
    clientIds = (linked ?? []).map((c) => c.id)
  } else {
    const { data } = await svc.from('clients').select('phone, alternate_phone, co_applicant_phone, nominee_phone, lead_id').eq('id', id).maybeSingle()
    if (!data) return { ok: false, errors: ['Client not found'], summary }
    phones = [data.phone, data.alternate_phone, data.co_applicant_phone, data.nominee_phone].filter(Boolean) as string[]
    clientIds = [id]
    if (data.lead_id) leadIds = [data.lead_id]
  }
  const tails = [...new Set(phones.map((p) => lastTenDigits(p)).filter((t): t is string => !!t && t.length >= 7))]

  // Duplicate lead records for the same person (same phone) are erased too.
  for (const t of tails) {
    const { data } = await svc.from('leads').select('id').like('phone', `%${t}`)
    for (const l of data ?? []) if (!leadIds.includes(l.id)) leadIds.push(l.id)
  }

  // ── WhatsApp threads: messages, stored media, then the conversation itself ──
  const convIds = new Set<string>()
  if (leadIds.length) {
    const { data } = await svc.from('whatsapp_conversations').select('id').in('lead_id', leadIds)
    ;(data ?? []).forEach((c) => convIds.add(c.id))
  }
  if (clientIds.length) {
    const { data } = await svc.from('whatsapp_conversations').select('id').in('client_id', clientIds)
    ;(data ?? []).forEach((c) => convIds.add(c.id))
  }
  for (const t of tails) {
    const { data } = await svc.from('whatsapp_conversations').select('id').like('contact_phone', `%${t}`)
    ;(data ?? []).forEach((c) => convIds.add(c.id))
  }
  if (convIds.size) {
    const ids = [...convIds]
    const { data: media } = await svc.from('whatsapp_messages').select('media_url').in('conversation_id', ids).not('media_url', 'is', null)
    const paths = (media ?? [])
      .map((m) => m.media_url as string)
      .filter((u) => u.startsWith(`${WA_BUCKET}/`) || u.includes(`/${WA_BUCKET}/`))
      .map((u) => u.slice(u.indexOf(`${WA_BUCKET}/`) + WA_BUCKET.length + 1))
    if (paths.length) {
      const { error } = await svc.storage.from(WA_BUCKET).remove(paths)
      check('whatsapp media', error, `${paths.length} WhatsApp file(s) removed`)
    }
    const { error: mErr } = await svc.from('whatsapp_messages').delete().in('conversation_id', ids)
    check('whatsapp messages', mErr)
    const { error: cErr } = await svc.from('chatbot_sessions').delete().in('conversation_id', ids)
    check('chatbot sessions', cErr)
    const { error: vErr } = await svc.from('whatsapp_conversations').delete().in('id', ids)
    check('whatsapp conversations', vErr, `${ids.length} WhatsApp conversation(s) deleted`)
  }

  // ── Client: KYC documents (rows + files), then the identity itself ──
  for (const cid of clientIds) {
    const { data: docs } = await svc.from('client_documents').select('id, file_url').eq('client_id', cid)
    const { data: client } = await svc.from('clients').select('photo_url').eq('id', cid).maybeSingle()
    const urls = [...(docs ?? []).map((d) => d.file_url as string | null), client?.photo_url as string | null]
    // Legacy public-bucket links …
    const storagePaths = urls
      .filter((u): u is string => !!u && u.includes('/storage/v1/object/'))
      .map((u) => u.split('/storage/v1/object/')[1].replace(/^(public|sign|authenticated)\//, '').split('?')[0])
    for (const full of storagePaths) {
      const bucket = full.slice(0, full.indexOf('/'))
      const path = full.slice(full.indexOf('/') + 1)
      const { error } = await svc.storage.from(bucket).remove([path])
      check(`document file ${path}`, error)
    }
    // … and uploads in the private bucket (stored as /api/files/…), plus anything else filed under
    // this client's folder. These used to be missed, so KYC files outlived the erasure.
    const privatePaths = new Set(urls.map(filePathFromUrl).filter((p): p is string => !!p))
    const { data: folder } = await svc.storage.from(FILES_BUCKET).list(`clients/${cid}`, { limit: 1000 })
    for (const f of folder ?? []) privatePaths.add(`clients/${cid}/${f.name}`)
    if (privatePaths.size) {
      const { error } = await svc.storage.from(FILES_BUCKET).remove([...privatePaths])
      check('private files', error, `${privatePaths.size} stored file(s) removed`)
    }
    const { error: dErr } = await svc.from('client_documents').delete().eq('client_id', cid)
    check('client documents', dErr, `${docs?.length ?? 0} KYC document(s) deleted`)

    const { error: cErr } = await svc.from('clients').update({
      full_name: DELETED, phone: `deleted-${cid.slice(0, 8)}`, alternate_phone: null, email: null,
      date_of_birth: null, permanent_address: null, communication_address: null, photo_url: null,
      occupation_type: null, company_name: null, monthly_income: null, annual_income: null,
      pan_encrypted: null, aadhar_encrypted: null,
      co_applicant_name: null, co_applicant_relationship: null, co_applicant_phone: null,
      co_applicant_pan_encrypted: null, co_applicant_aadhar_encrypted: null,
      nominee_name: null, nominee_relationship: null, nominee_dob: null, nominee_phone: null,
      whatsapp_opt_in: false, portal_user_id: null, updated_at: now,
    }).eq('id', cid)
    check('client record', cErr, 'client identity anonymised (bookings and payments kept for legal retention)')

    await svc.from('portal_sessions').delete().eq('client_id', cid)
    const { error: kErr } = await svc.from('complaints').update({ description: DELETED, photo_urls: [], updated_at: now }).eq('client_id', cid)
    check('complaints', kErr)
  }

  // ── Lead: timeline, visits, broker registrations, then the identity ──
  for (const lid of leadIds) {
    const { error: aErr } = await svc.from('lead_activities').update({ notes: null, recording_url: null }).eq('lead_id', lid)
    check('lead activities', aErr, 'activity notes and call recordings cleared')
    const { error: sErr } = await svc.from('site_visits')
      .update({ client_feedback: null, advisor_notes: null, notes: null, photos: [] }).eq('lead_id', lid)
    check('site visits', sErr)
    const { error: bErr } = await svc.from('broker_lead_registrations')
      .update({ client_name: DELETED, client_phone: `deleted-${lid.slice(0, 8)}`, notes: null }).eq('crm_lead_id', lid)
    check('broker registrations', bErr)
    const { error: nErr } = await svc.from('notifications').delete().eq('related_record_type', 'lead').eq('related_record_id', lid)
    check('notifications', nErr)
    const { error: lErr } = await svc.from('leads').update({
      // One placeholder per record: several erased leads may share a unique phone column.
      full_name: DELETED, phone: `deleted-${lid.slice(0, 8)}`, alternate_phone: null, email: null,
      city: null, locality: null, landing_page_url: null, whatsapp_opt_in: false,
      is_active: false, next_followup_at: null, updated_at: now,
    }).eq('id', lid)
    check('lead record', lErr, 'lead identity anonymised')
  }

  // ── Loan files: income and credit details (the loan amounts stay with the booking) ──
  if (clientIds.length) {
    const { error } = await svc.from('loan_applications')
      .update({ monthly_income: null, existing_emis: null, credit_score: null, notes: null, updated_at: now })
      .in('client_id', clientIds)
    check('loan applications', error)
  }

  // ── Logs that copied the name or phone ──
  const allIds = [...leadIds, ...clientIds]
  if (allIds.length) {
    const { error: aErr } = await svc.from('automation_logs')
      .update({ lead_name: DELETED, lead_phone: null, context_snapshot: null }).in('trigger_record_id', allIds)
    check('automation logs', aErr)
    const { error: pErr } = await svc.from('automation_pending_executions')
      .update({ status: 'cancelled', context_snapshot: {} }).in('trigger_record_id', allIds).eq('status', 'pending')
    check('queued automations', pErr)
    // The consent trail itself is kept (proof of what was agreed and withdrawn), without the name.
    const { error: cErr } = await svc.from('consent_logs').update({ entity_name: DELETED }).in('entity_id', allIds)
    check('consent log names', cErr)
  }
  for (const cid of clientIds) {
    const { error } = await svc.from('notifications').delete().eq('related_record_type', 'client').eq('related_record_id', cid)
    check('notifications', error)
  }

  return { ok: errors.length === 0, errors, summary }
}
