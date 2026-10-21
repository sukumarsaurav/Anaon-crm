import { NextRequest, NextResponse } from 'next/server'
import { checkBearer } from '@/lib/security/secrets'
import { createServiceClient } from '@/lib/supabase/service'
import { fireAutomations, runAutomation } from '@/lib/automation/engine'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  if (!checkBearer(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  // Calendar day in IST, not UTC: this runs every 15 minutes, and UTC midnight is 05:30 IST.
  const today = new Date(Date.now() + 330 * 60000).toISOString().split('T')[0]
  const results: Record<string, number> = {}

  // ── 1. Payment due in 7 days ──────────────────────────────────────────────
  const sevenDaysOut = new Date(Date.now() + 330 * 60000 + 7 * 86400000).toISOString().split('T')[0]
  const { data: duePayments } = await supabase
    .from('payments')
    .select('id, amount_due, due_date, client_id, booking_id, clients(full_name, phone, date_of_birth), bookings!inner(status)')
    .eq('due_date', sevenDaysOut)
    .in('status', ['pending', 'overdue'])
    .eq('bookings.status', 'confirmed') // a cancelled booking's installments must not keep chasing the client
    .limit(1000)

  let paymentDueCount = 0
  for (const payment of duePayments ?? []) {
    const client = (payment as any).clients
    await fireAutomations('payment_due_approaching', {
      payment: { id: payment.id, amount_due: Number(payment.amount_due), due_date: payment.due_date },
      client: client ? { id: payment.client_id, full_name: client.full_name, phone: client.phone } : undefined,
    }, 'payment', payment.id)
    paymentDueCount++
  }
  results.payment_due_approaching = paymentDueCount

  // ── 2. Overdue payments ───────────────────────────────────────────────────
  const { data: overduePayments } = await supabase
    .from('payments')
    .select('id, amount_due, due_date, client_id, clients(full_name, phone), bookings!inner(status)')
    .lt('due_date', today)
    .in('status', ['pending', 'overdue'])
    .eq('bookings.status', 'confirmed')
    .limit(1000)

  let overdueCount = 0
  for (const payment of overduePayments ?? []) {
    const client = (payment as any).clients
    // Whole IST days: computing from UTC midnight made it 0 shortly after IST midnight and 1 later the
    // same day, so a client could get two "overdue" messages within hours.
    const daysOverdue = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${payment.due_date}T00:00:00Z`)) / 86400000)
    // Only fire on first overdue day or every 7 days after
    if (daysOverdue === 1 || daysOverdue % 7 === 0) {
      await fireAutomations('payment_overdue', {
        payment: { id: payment.id, amount_due: Number(payment.amount_due), due_date: payment.due_date },
        client: client ? { id: payment.client_id, full_name: client.full_name, phone: client.phone } : undefined,
        extra: { daysOverdue },
      }, 'payment', payment.id)
      overdueCount++
    }
  }
  results.payment_overdue = overdueCount

  // ── 3. Client birthdays ───────────────────────────────────────────────────
  const todayMMDD = today.slice(5) // MM-DD
  // date columns can't be matched with LIKE (Postgres: "operator does not exist: date ~~ unknown"),
  // which made this query fail silently — birthdays and anniversaries never fired. Match in code.
  const { data: dobClients, error: dobErr } = await supabase
    .from('clients')
    .select('id, full_name, phone, date_of_birth')
    .not('date_of_birth', 'is', null)
    .limit(5000)
  if (dobErr) console.error('[cron/automations] birthdays query failed', dobErr.message)
  const birthdayClients = (dobClients ?? []).filter((c) => String(c.date_of_birth).slice(5) === todayMMDD)

  let birthdayCount = 0
  for (const client of birthdayClients) {
    await fireAutomations('client_birthday', {
      client: { id: client.id, full_name: client.full_name, phone: client.phone, date_of_birth: client.date_of_birth },
    }, 'client', client.id)
    birthdayCount++
  }
  results.client_birthday = birthdayCount

  // ── 4. Booking anniversaries ──────────────────────────────────────────────
  const { data: confirmedBookings, error: annErr } = await supabase
    .from('bookings')
    .select('id, booking_date, client_id, project_id, clients(full_name, phone)')
    .eq('status', 'confirmed')
    .not('booking_date', 'is', null)
    .limit(5000)
  if (annErr) console.error('[cron/automations] anniversaries query failed', annErr.message)
  const anniversaryBookings = (confirmedBookings ?? []).filter(
    (b) => String(b.booking_date).slice(5) === todayMMDD && b.booking_date !== today, // not this year's booking
  )

  let anniversaryCount = 0
  for (const booking of anniversaryBookings) {
    const client = (booking as any).clients
    await fireAutomations('booking_anniversary', {
      booking: { id: booking.id, booking_date: booking.booking_date, project_id: booking.project_id },
      client: client ? { id: booking.client_id, full_name: client.full_name, phone: client.phone } : undefined,
    }, 'booking', booking.id)
    anniversaryCount++
  }
  results.booking_anniversary = anniversaryCount

  // ── 5. Follow-up overdue (no activity for 48h) ────────────────────────────
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600000).toISOString()
  const { data: overdueLeads } = await supabase
    .from('leads')
    .select('id, full_name, phone, assigned_to, source, stage, utm_source, project_id')
    .eq('is_active', true)
    .not('stage', 'in', '(token_paid,closed_won,not_interested)')
    .lt('updated_at', fortyEightHoursAgo)
    .order('updated_at', { ascending: true }) // stalest first; unordered it was an arbitrary 50 every run
    .limit(200)

  let followupCount = 0
  for (const lead of overdueLeads ?? []) {
    await fireAutomations('follow_up_overdue', {
      lead: { id: lead.id, full_name: lead.full_name, phone: lead.phone, assigned_to: lead.assigned_to, source: lead.source, stage: lead.stage, utm_source: lead.utm_source, project_id: lead.project_id },
    }, 'lead', lead.id)
    followupCount++
  }
  results.follow_up_overdue = followupCount

  // ── 6. Process pending delayed executions ─────────────────────────────────
  const { data: pending } = await supabase
    .from('automation_pending_executions')
    .select('*, automation:automations(*)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(50)

  let pendingCount = 0
  for (const exec of pending ?? []) {
    const automation = (exec as any).automation
    // Claim first: a second overlapping cron run must not execute it again.
    const { data: claimed } = await supabase.from('automation_pending_executions')
      .update({ status: 'running' })
      .eq('id', exec.id)
      .eq('status', 'pending')
      .select('id')
    if (!claimed?.length) continue
    if (!automation || !automation.is_active) {
      await supabase.from('automation_pending_executions').update({ status: 'cancelled', executed_at: new Date().toISOString() }).eq('id', exec.id)
      continue
    }
    try {
      const res = await runAutomation(automation, exec.context_snapshot ?? {}, exec.trigger_record_type, exec.trigger_record_id, `autodelay_${exec.id}`)
      await supabase.from('automation_pending_executions')
        .update({ status: res.success ? 'executed' : 'failed', executed_at: new Date().toISOString() })
        .eq('id', exec.id)
      pendingCount++
    } catch {
      await supabase.from('automation_pending_executions').update({ status: 'failed' }).eq('id', exec.id)
    }
  }
  results.pending_executed = pendingCount

  return NextResponse.json({ ok: true, results })
}

// Also accept GET for simple health check / manual trigger
export async function GET(req: NextRequest) {
  return POST(req)
}
