import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireAutomations } from '@/lib/automation/engine'

const CRON_SECRET = process.env.CRON_SECRET ?? 'anon_india_cron_secret'

// Stages where a follow-up reminder no longer makes sense.
const CLOSED_STAGES_FILTER = '("closed_won","not_interested")'

/**
 * Fires follow-up reminders for leads whose next_followup_at has come due.
 *
 * A reminder is sent once per scheduled follow-up: we stamp
 * followup_reminder_sent_at when we notify, and the lead actions reset that
 * stamp to NULL whenever a new follow-up is scheduled. This keeps the cron
 * idempotent — running it every 15 min will not spam reps.
 *
 * Triggered by Vercel Cron (GET) or any external scheduler (GET/POST).
 * Vercel auto-adds `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 *   GET|POST /api/cron/followup-reminders   Authorization: Bearer <CRON_SECRET>
 */
async function handler(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  // Due (or overdue) follow-ups on active, open leads that have an owner and
  // have not already been reminded for this follow-up.
  const { data: dueLeads, error } = await supabase
    .from('leads')
    .select('id, full_name, phone, stage, assigned_to, next_followup_at, project_id, utm_source')
    .eq('is_active', true)
    .not('assigned_to', 'is', null)
    .not('stage', 'in', CLOSED_STAGES_FILTER)
    .lte('next_followup_at', nowIso)
    .is('followup_reminder_sent_at', null)
    .order('next_followup_at', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let notified = 0
  for (const lead of dueLeads ?? []) {
    // Pull the last note/outcome so the rep has context in the reminder.
    const { data: lastActivity } = await supabase
      .from('lead_activities')
      .select('notes, outcome')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastNote = lastActivity?.notes ? ` Last note: "${lastActivity.notes}"` : ''

    await supabase.from('notifications').insert({
      user_id: lead.assigned_to,
      title: `Follow-up due: ${lead.full_name}`,
      body: `${lead.full_name} (${lead.phone}) is due for follow-up.${lastNote}`,
      type: 'followup_reminder',
      related_record_type: 'lead',
      related_record_id: lead.id,
      action_url: `/leads/${lead.id}`,
    })

    await supabase
      .from('leads')
      .update({ followup_reminder_sent_at: nowIso })
      .eq('id', lead.id)

    // Let the automation engine deliver downstream (e.g. push / WhatsApp).
    fireAutomations(
      'follow_up_overdue',
      {
        lead: {
          id: lead.id,
          full_name: lead.full_name,
          phone: lead.phone,
          stage: lead.stage,
          assigned_to: lead.assigned_to,
          project_id: lead.project_id,
          utm_source: lead.utm_source,
        },
      },
      'lead',
      lead.id,
    )

    notified++
  }

  return NextResponse.json({ ok: true, notified, scanned: dueLeads?.length ?? 0 })
}

export const GET = handler
export const POST = handler
