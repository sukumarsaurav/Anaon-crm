import { NextRequest, NextResponse } from 'next/server'
import { checkBearer } from '@/lib/security/secrets'
import { runDueBroadcasts } from '@/lib/whatsapp/broadcast'

const CRON_SECRET = process.env.CRON_SECRET

export const maxDuration = 60

/**
 * Starts scheduled WhatsApp broadcasts that are due and sends the next batch of any still
 * going. Vercel's cron runs it daily (vercel.json); for broadcasts to go out at their
 * scheduled minute, point an external scheduler at it every few minutes with
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: NextRequest) {
  if (!checkBearer(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runDueBroadcasts(50_000)
  return NextResponse.json({ ok: true, ...result })
}

export const GET = handle
export const POST = handle
