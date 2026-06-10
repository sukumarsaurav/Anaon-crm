import { NextRequest, NextResponse } from 'next/server'
import { ingestLead } from '@/lib/leads/ingest'
import type { LeadSource } from '@/types/leads'

const WEBHOOK_SECRET = process.env.LEAD_WEBHOOK_SECRET ?? 'anon_india_lead_secret'

// Maps the URL slug → canonical lead_source enum value.
const SOURCE_MAP: Record<string, LeadSource> = {
  '99acres': '99acres',
  magicbricks: 'magicbricks',
  housing: 'housing',
  justdial: 'justdial',
  indiamart: 'indiamart',
  linkedin: 'linkedin',
  'google-lead-form': 'google_lead_form',
  website: 'website_form',
  generic: 'website_form',
}

/** Pick the first present value from a list of candidate keys (case-insensitive). */
function pick(body: Record<string, unknown>, keys: string[]): string | null {
  const lower: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) lower[k.toLowerCase()] = v
  for (const key of keys) {
    const v = lower[key.toLowerCase()]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

function toNumber(v: string | null): number | null {
  if (!v) return null
  const n = Number(v.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Generic inbound lead webhook. One endpoint per source:
 *   POST /api/webhooks/leads/99acres?token=<LEAD_WEBHOOK_SECRET>
 *   POST /api/webhooks/leads/justdial?token=...
 *
 * Accepts JSON with common field names across portals (name/phone/email/
 * requirement/city/budget). Unknown sources are rejected.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  const { source: slug } = await params

  // Auth via shared secret (header or ?token=). Portals can't send Bearer auth.
  const token = req.nextUrl.searchParams.get('token') ?? req.headers.get('x-webhook-secret')
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = SOURCE_MAP[slug.toLowerCase()]
  if (!source) {
    return NextResponse.json({ error: `Unknown source: ${slug}` }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const budgetRaw = pick(body, ['budget', 'budget_max', 'max_budget', 'price'])

  const result = await ingestLead({
    source,
    full_name: pick(body, ['full_name', 'name', 'lead_name', 'customer_name', 'sender_name']),
    phone: pick(body, ['phone', 'mobile', 'mobile_number', 'contact', 'contact_number', 'phone_number']),
    email: pick(body, ['email', 'email_id']),
    city: pick(body, ['city', 'location']),
    locality: pick(body, ['locality', 'area']),
    requirement: pick(body, ['requirement', 'message', 'query', 'query_message', 'enquiry', 'comments', 'project']),
    configuration: pick(body, ['configuration', 'bhk', 'unit_type']),
    property_type: pick(body, ['property_type', 'category']),
    budget_max: toNumber(budgetRaw),
    campaign_name: pick(body, ['campaign', 'campaign_name']),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }
  return NextResponse.json({
    ok: true,
    lead_id: result.id,
    duplicate: result.duplicate ?? false,
  })
}
