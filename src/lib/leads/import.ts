'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/supabase/getProfile'
import { ingestLead } from './ingest'
import type { LeadSource } from '@/types/leads'

const VALID_SOURCES: LeadSource[] = [
  'facebook_ads','instagram_ads','google_ads','google_lead_form','website_form','whatsapp',
  'manual','walk_in','referral','ivr','portal','broker','99acres','magicbricks','housing',
  'justdial','indiamart','linkedin',
]

/** Target lead fields a CSV column can map to. */
export type ImportField =
  | 'full_name' | 'phone' | 'email' | 'city' | 'locality'
  | 'requirement' | 'configuration' | 'budget_max' | 'source'

export interface ImportResult {
  ok: boolean
  created: number
  duplicates: number
  failed: number
  errors: string[]
  error?: string
}

function num(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Bulk-import leads from parsed CSV rows. Each row is normalized via the shared
 * ingestLead (phone-dedupe + score + activity + automations). `assignTo` forces
 * all rows to a member; otherwise assignment rules / round-robin apply.
 */
export async function importLeads(
  rows: Record<string, string>[],
  mapping: Partial<Record<ImportField, string>>,
  opts: { assignTo?: string | null; defaultSource?: LeadSource } = {},
): Promise<ImportResult> {
  const profile = (await getProfile())?.profile
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return { ok: false, created: 0, duplicates: 0, failed: 0, errors: [], error: 'Admin or manager only' }
  }
  if (!mapping.phone) {
    return { ok: false, created: 0, duplicates: 0, failed: 0, errors: [], error: 'Map the phone column' }
  }

  let created = 0, duplicates = 0, failed = 0
  const errors: string[] = []
  const get = (row: Record<string, string>, f: ImportField) =>
    mapping[f] ? (row[mapping[f]!] ?? '').trim() : ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rawSource = get(row, 'source').toLowerCase().replace(/\s+/g, '_')
    const source = (VALID_SOURCES.includes(rawSource as LeadSource) ? rawSource : (opts.defaultSource ?? 'manual')) as LeadSource

    const res = await ingestLead({
      source,
      full_name: get(row, 'full_name') || null,
      phone: get(row, 'phone') || null,
      email: get(row, 'email') || null,
      city: get(row, 'city') || null,
      locality: get(row, 'locality') || null,
      requirement: get(row, 'requirement') || null,
      configuration: get(row, 'configuration') || null,
      budget_max: num(get(row, 'budget_max')),
      assignedToOverride: opts.assignTo || null,
    })

    if (res.ok && res.duplicate) duplicates++
    else if (res.ok) created++
    else { failed++; if (errors.length < 20) errors.push(`Row ${i + 2}: ${res.error}`) }
  }

  revalidatePath('/leads')
  return { ok: true, created, duplicates, failed, errors }
}
