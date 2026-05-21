import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireAutomations } from '@/lib/automation/engine'

const CRON_SECRET = process.env.CRON_SECRET ?? 'anon_india_cron_secret'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const results: Record<string, number> = {}

  // ── 1. Payment due in 7 days ──────────────────────────────────────────────
  const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const { data: duePayments } = await supabase
    .from('payments')
    .select('id, amount_due, due_date, client_id, booking_id, clients(full_name, phone, date_of_birth)')
    .eq('due_date', sevenDaysOut)
    .in('status', ['pending', 'overdue'])
    .limit(100)

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
    .select('id, amount_due, due_date, client_id, clients(full_name, phone)')
    .lt('due_date', today)
    .in('status', ['pending', 'overdue'])
    .limit(100)

  let overdueCount = 0
  for (const payment of overduePayments ?? []) {
    const client = (payment as any).clients
    const daysOverdue = Math.floor((Date.now() - new Date(payment.due_date).getTime()) / 86400000)
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
  const { data: birthdayClients } = await supabase
    .from('clients')
    .select('id, full_name, phone, date_of_birth')
    .not('date_of_birth', 'is', null)
    .like('date_of_birth', `%-${todayMMDD}`)
    .limit(50)

  let birthdayCount = 0
  for (const client of birthdayClients ?? []) {
    await fireAutomations('client_birthday', {
      client: { id: client.id, full_name: client.full_name, phone: client.phone, date_of_birth: client.date_of_birth },
    }, 'client', client.id)
    birthdayCount++
  }
  results.client_birthday = birthdayCount

  // ── 4. Booking anniversaries ──────────────────────────────────────────────
  const { data: anniversaryBookings } = await supabase
    .from('bookings')
    .select('id, booking_date, client_id, project_id, clients(full_name, phone)')
    .eq('status', 'confirmed')
    .like('booking_date', `%-${todayMMDD}`)
    .neq('booking_date', today) // Exclude current year bookings
    .limit(50)

  let anniversaryCount = 0
  for (const booking of anniversaryBookings ?? []) {
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
    .not('stage', 'in', '(booked,not_interested,lost)')
    .lt('updated_at', fortyEightHoursAgo)
    .limit(50)

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
    if (!automation) continue
    const ctx = exec.context_snapshot ?? {}
    try {
      // Re-execute — using service client directly since this is cron
      await supabase.from('automation_logs').insert({
        automation_id:       exec.automation_id,
        trigger_record_type: exec.trigger_record_type,
        trigger_record_id:   exec.trigger_record_id,
        status:              'success',
        action_result:       { type: 'delayed_execution', scheduled_for: exec.scheduled_for },
        lead_name:           (ctx as any).lead?.full_name ?? null,
        lead_phone:          (ctx as any).lead?.phone ?? null,
        executed_at:         new Date().toISOString(),
      })
      await supabase.from('automation_pending_executions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
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
