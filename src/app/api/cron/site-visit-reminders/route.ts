import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireAutomations } from '@/lib/automation/engine'

const CRON_SECRET = process.env.CRON_SECRET ?? 'anon_india_cron_secret'

/**
 * Day-of reminder for scheduled site visits. Run once each morning; notifies the
 * accompanying advisor (or the lead owner) of visits happening today.
 * Idempotent via site_visits.reminded_at.
 *   GET|POST /api/cron/site-visit-reminders   Authorization: Bearer <CRON_SECRET>
 */
async function handler(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // "Today" means the IST calendar day, computed independently of the server's
  // timezone (Vercel runs in UTC). Convert IST-midnight bounds back to UTC.
  const IST_OFFSET_MIN = 330
  const istNow = new Date(now.getTime() + IST_OFFSET_MIN * 60000)
  const istMidnight = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  const dayStart = new Date(istMidnight - IST_OFFSET_MIN * 60000)
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600000 - 1)

  const { data: visits, error } = await supabase
    .from('site_visits')
    .select('id, lead_id, scheduled_at, accompanied_by, project_id, leads(full_name, phone, assigned_to)')
    .eq('status', 'scheduled')
    .is('reminded_at', null)
    .gte('scheduled_at', dayStart.toISOString())
    .lte('scheduled_at', dayEnd.toISOString())
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let notified = 0
  for (const v of visits ?? []) {
    const rawLead = (v as { leads?: unknown }).leads
    const lead = (Array.isArray(rawLead) ? rawLead[0] : rawLead) as
      | { full_name: string; phone: string; assigned_to: string | null }
      | undefined
    const recipient = v.accompanied_by ?? lead?.assigned_to
    if (!recipient) continue

    const time = new Date(v.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    await supabase.from('notifications').insert({
      user_id: recipient,
      title: `Site visit today: ${lead?.full_name ?? 'Lead'}`,
      body: `Visit with ${lead?.full_name ?? 'lead'} (${lead?.phone ?? ''}) at ${time}.`,
      type: 'site_visit_reminder',
      related_record_type: 'lead',
      related_record_id: v.lead_id,
      action_url: `/leads/${v.lead_id}`,
    })
    await supabase.from('site_visits').update({ reminded_at: now.toISOString() }).eq('id', v.id)

    if (lead) {
      fireAutomations(
        'site_visit_scheduled',
        {
          lead: {
            id: v.lead_id,
            full_name: lead.full_name,
            phone: lead.phone,
            stage: 'site_visit_scheduled',
            assigned_to: lead.assigned_to,
            project_id: v.project_id,
            utm_source: null,
          },
        },
        'lead',
        v.lead_id,
      )
    }
    notified++
  }

  return NextResponse.json({ ok: true, notified, scanned: visits?.length ?? 0 })
}

export const GET = handler
export const POST = handler
