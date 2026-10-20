import { createServiceClient } from '@/lib/supabase/service'
import { lastTenDigits } from '@/lib/whatsapp/phone'

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
  const placeholderPhone = `deleted-${id.slice(0, 8)}`

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
    const storagePaths = (docs ?? [])
      .map((d) => d.file_url as string | null)
      .filter((u): u is string => !!u && u.includes('/storage/v1/object/'))
      .map((u) => u.split('/storage/v1/object/')[1].replace(/^(public|sign|authenticated)\//, '').split('?')[0])
    for (const full of storagePaths) {
      const bucket = full.slice(0, full.indexOf('/'))
      const path = full.slice(full.indexOf('/') + 1)
      const { error } = await svc.storage.from(bucket).remove([path])
      check(`document file ${path}`, error)
    }
    const { error: dErr } = await svc.from('client_documents').delete().eq('client_id', cid)
    check('client documents', dErr, `${docs?.length ?? 0} KYC document(s) deleted`)

    const { error: cErr } = await svc.from('clients').update({
      full_name: DELETED, phone: placeholderPhone, alternate_phone: null, email: null,
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
      .update({ client_name: DELETED, client_phone: placeholderPhone, notes: null }).eq('crm_lead_id', lid)
    check('broker registrations', bErr)
    const { error: lErr } = await svc.from('leads').update({
      full_name: DELETED, phone: placeholderPhone, alternate_phone: null, email: null,
      city: null, locality: null, landing_page_url: null, whatsapp_opt_in: false,
      is_active: false, next_followup_at: null, updated_at: now,
    }).eq('id', lid)
    check('lead record', lErr, 'lead identity anonymised')
  }

  return { ok: errors.length === 0, errors, summary }
}
