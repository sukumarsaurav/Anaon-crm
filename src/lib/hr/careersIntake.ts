import { randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyUsers } from '@/lib/notifications/notify'
import { sendEmail, emailConfigured } from '@/lib/email/client'
import { genericEmail } from '@/lib/email/templates'
import { FILES_BUCKET, fileUrl } from '@/lib/files/storage'

/**
 * Job applications from the public website. Plain module used by /api/webhooks/careers (the website
 * forwards to it with a shared secret, so the CRM is the one place applications live).
 */

export const RESUME_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
export const RESUME_MAX_BYTES = 5 * 1024 * 1024
const RESUME_PREFIX = 'hr/applications/'

export interface ApplicationInput {
  listing_id?: string | null
  listing_title?: string | null
  name?: string
  phone?: string
  email?: string | null
  cover_letter?: string | null
  resume_url?: string | null
  cv_consent?: boolean
  /** Honeypot: a hidden field people never fill. */
  company_website?: string | null
}

type Outcome = { ok: true; id?: string; duplicate?: boolean } | { ok: false; status: number; error: string }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function receiveApplication(input: ApplicationInput): Promise<Outcome> {
  // Bots fill every field; answer as if it worked and store nothing.
  if (str(input.company_website, 200)) return { ok: true }

  const name = str(input.name, 120)
  const phone = str(input.phone, 30).replace(/\D/g, '').slice(-10)
  const email = str(input.email, 200).toLowerCase() || null
  if (!name || phone.length !== 10) return { ok: false, status: 400, error: 'Name and a 10-digit phone number are required.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, status: 400, error: 'Enter a valid email address.' }
  const resume = str(input.resume_url, 500) || null
  // Only files uploaded through our own slot (below) are accepted.
  if (resume && !resume.startsWith(`/api/files/${RESUME_PREFIX}`)) return { ok: false, status: 400, error: 'Upload the CV again.' }
  if (resume && !input.cv_consent) return { ok: false, status: 400, error: 'Please agree to us keeping your CV to apply with it.' }

  const svc = createServiceClient()
  // Listing ids from an older copy of the website may not exist here: keep the title instead.
  let listingId: string | null = null
  let listingTitle = str(input.listing_title, 200) || null
  if (input.listing_id && /^[0-9a-f-]{36}$/i.test(input.listing_id)) {
    const { data } = await svc.from('career_listings').select('id, title').eq('id', input.listing_id).maybeSingle()
    if (data) { listingId = data.id; listingTitle = data.title }
  }

  // The same person applying again within a day (double submit, refresh) is one application.
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { data: recent } = await svc.from('career_applications').select('id, listing_id').eq('phone', phone).gte('created_at', since)
  if ((recent ?? []).some((r) => r.listing_id === listingId)) return { ok: true, duplicate: true }

  const cover = str(input.cover_letter, 4000)
  const { data: row, error } = await svc.from('career_applications').insert({
    listing_id: listingId,
    name, phone, email,
    cover_letter: [listingId ? null : listingTitle ? `Applied for: ${listingTitle}` : null, cover || null].filter(Boolean).join('\n\n') || null,
    resume_url: resume,
    cv_consent_at: resume && input.cv_consent ? new Date().toISOString() : null,
    source: 'website',
    stage: 'applied',
  }).select('id').single()
  if (error) return { ok: false, status: 500, error: 'Could not save the application.' }

  const { data: hr } = await svc.from('profiles').select('id').in('role', ['admin', 'manager']).eq('is_active', true)
  await notifyUsers((hr ?? []).map((p) => p.id), {
    title: 'New job application', message: `${name}${listingTitle ? ` applied for ${listingTitle}` : ' applied'}.`,
    type: 'system', action_url: '/hr/recruitment',
  })
  if (email && emailConfigured()) {
    const tpl = genericEmail('We received your application',
      `Hi ${name},\n\nThank you for applying${listingTitle ? ` for ${listingTitle}` : ''} at ANON INDIA. Our HR team reviews every application and will contact you if your profile matches.\n\nRegards,\nANON INDIA HR`)
    await sendEmail({ to: email, subject: tpl.subject, html: tpl.html })
  }
  return { ok: true, id: row.id }
}

/** A one-time slot for the applicant's browser to upload a CV straight to private storage. */
export async function resumeUploadSlot(input: { filename?: string; contentType?: string; size?: number }):
  Promise<{ ok: true; signedUrl: string; fileUrl: string } | { ok: false; status: number; error: string }> {
  if (!RESUME_TYPES.includes(String(input.contentType))) return { ok: false, status: 400, error: 'Upload a PDF or Word file.' }
  const size = Number(input.size)
  if (!(size > 0) || size > RESUME_MAX_BYTES) return { ok: false, status: 400, error: 'The CV must be under 5 MB.' }
  const safe = String(input.filename ?? 'cv').normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-60) || 'cv'
  const month = new Date().toISOString().slice(0, 7)
  const path = `${RESUME_PREFIX}${month}/${Date.now()}-${randomBytes(6).toString('hex')}-${safe}`
  const { data, error } = await createServiceClient().storage.from(FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, status: 500, error: 'Could not prepare the upload.' }
  return { ok: true, signedUrl: data.signedUrl, fileUrl: fileUrl(path) }
}
