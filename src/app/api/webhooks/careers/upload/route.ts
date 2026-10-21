import { NextRequest, NextResponse } from 'next/server'
import { matchesSecret } from '@/lib/security/secrets'
import { resumeUploadSlot } from '@/lib/hr/careersIntake'

const SECRET = process.env.CAREERS_WEBHOOK_SECRET

/**
 * A one-time CV upload slot (PDF / Word, up to 5 MB). The website's server asks for it and hands the
 * signed URL to the applicant's browser, which PUTs the file straight to private storage.
 *   POST /api/webhooks/careers/upload   x-webhook-secret   { filename, contentType, size }
 */
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: 'Careers intake is not configured' }, { status: 503 })
  if (!matchesSecret(SECRET, req.headers.get('x-webhook-secret'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const r = await resumeUploadSlot(body)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ signedUrl: r.signedUrl, fileUrl: r.fileUrl })
}
