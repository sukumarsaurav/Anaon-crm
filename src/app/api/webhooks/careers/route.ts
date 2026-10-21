import { NextRequest, NextResponse } from 'next/server'
import { matchesSecret } from '@/lib/security/secrets'
import { receiveApplication } from '@/lib/hr/careersIntake'

const SECRET = process.env.CAREERS_WEBHOOK_SECRET

/**
 * Job applications forwarded by the public website's server.
 *   POST /api/webhooks/careers   x-webhook-secret: <CAREERS_WEBHOOK_SECRET>
 *   { listing_id?, listing_title?, name, phone, email?, cover_letter?, resume_url?, cv_consent?, company_website? }
 */
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: 'Careers intake is not configured' }, { status: 503 })
  if (!matchesSecret(SECRET, req.headers.get('x-webhook-secret'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const r = await receiveApplication(body)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ success: true })
}
