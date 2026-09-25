import { NextRequest, NextResponse } from 'next/server'
import { checkBearer } from '@/lib/security/secrets'
import { createServiceClient } from '@/lib/supabase/service'
import { fireAutomations } from '@/lib/automation/engine'
import { notifyUsers } from '@/lib/notifications/notify'

const CRON_SECRET = process.env.CRON_SECRET

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
  if (!checkBearer(req.headers.get('authorization'), CRON_SECRET)) {
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

  const leads = dueLeads ?? []

  // Batch-fetch the latest note per due lead in one query (avoids N+1).
  const lastNoteByLead = new Map<string, string>()
  if (leads.length) {
    const { data: acts } = await supabase
      .from('lead_activities')
      .select('lead_id, notes, created_at')
      .in('lead_id', leads.map((l) => l.id))
      .not('notes', 'is', null)
      .order('created_at', { ascending: false })
    for (const a of acts ?? []) {
      if (a.lead_id && a.notes && !lastNoteByLead.has(a.lead_id)) lastNoteByLead.set(a.lead_id, a.notes)
    }
  }

  let notified = 0
  for (const lead of leads) {
    const note = lastNoteByLead.get(lead.id)
    const lastNote = note ? ` Last note: "${note}"` : ''

    await notifyUsers([lead.assigned_to], {
      title: `Follow-up due: ${lead.full_name}`,
      message: `${lead.full_name} (${lead.phone}) is due for follow-up.${lastNote}`,
      type: 'followup_reminder',
      related_type: 'lead',
      related_id: lead.id,
      action_url: `/leads/${lead.id}`,
    })

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

  // Batch-mark all reminded leads in one update (avoids N updates).
  if (leads.length) {
    await supabase
      .from('leads')
      .update({ followup_reminder_sent_at: nowIso })
      .in('id', leads.map((l) => l.id))
  }

  return NextResponse.json({ ok: true, notified, scanned: leads.length })
}

export const GET = handler
export const POST = handler
