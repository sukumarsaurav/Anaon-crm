'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { fireAutomations } from '@/lib/automation/engine'

async function getAuth() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, error: 'Unauthorized', supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

const isManager = (role: string) => ['admin', 'manager'].includes(role)

// ── Create booking ────────────────────────────────────────────

export async function createBooking(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const plotId    = formData.get('plot_id') as string
  const projectId = formData.get('project_id') as string
  const clientId  = formData.get('client_id') as string

  // Validate plot is still available
  const { data: plot } = await auth.supabase
    .from('plots').select('status, held_by').eq('id', plotId).single()
  if (!plot) return { success: false, error: 'Plot not found' }
  if (!['available', 'soft_hold'].includes(plot.status)) {
    return { success: false, error: `Plot is not available (status: ${plot.status})` }
  }
  // A plot another advisor is holding is theirs until the hold ends.
  if (plot.status === 'soft_hold' && plot.held_by && plot.held_by !== auth.userId && !isManager(auth.role)) {
    return { success: false, error: 'This plot is on hold for another advisor' }
  }

  const brokerId = formData.get('broker_id') as string || null
  let brokerPct: number | null = null
  let brokerAmount: number | null = null

  if (brokerId) {
    const { data: broker } = await auth.supabase
      .from('brokers').select('commission_rate').eq('id', brokerId).single()
    brokerPct    = broker?.commission_rate ?? null
    const total  = parseFloat(formData.get('total_sale_value') as string) || 0
    brokerAmount = brokerPct ? Math.round((total * brokerPct) / 100) : null
  }

  const { data, error } = await auth.supabase.from('bookings').insert({
    client_id:               clientId,
    plot_id:                 plotId,
    project_id:              projectId,
    total_sale_value:        parseFloat(formData.get('total_sale_value') as string),
    booking_amount:          parseFloat(formData.get('booking_amount') as string),
    payment_plan:            formData.get('payment_plan') as string || null,
    payment_plan_type:       formData.get('payment_plan_type') as string || 'custom',
    advisor_id:              formData.get('advisor_id') as string || auth.userId,
    broker_id:               brokerId,
    broker_commission_pct:   brokerPct,
    broker_commission_amount: brokerAmount,
    booking_date:            formData.get('booking_date') as string || new Date().toISOString().split('T')[0],
    agreement_date:          formData.get('agreement_date') as string || null,
    expected_possession_date: formData.get('expected_possession_date') as string || null,
    referred_by_source:      formData.get('referred_by_source') as string || null,
    notes:                   formData.get('notes') as string || null,
    status:                  'pending_approval',
    created_by:              auth.userId,
  }).select('id').single()

  if (error?.code === '23505') return { success: false, error: 'This plot already has an active booking' }
  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create booking' }

  // Hold the plot for the booking until it is approved or rejected. held_until is cleared:
  // the scheduled hold release would otherwise free the plot while this booking is still
  // pending approval, and a second booking could take it.
  const { error: holdErr } = await auth.supabase.from('plots')
    .update({ status: 'soft_hold', held_by: auth.userId, held_until: null, updated_at: new Date().toISOString() })
    .eq('id', plotId)
  if (holdErr) {
    await auth.supabase.from('bookings').delete().eq('id', data.id)
    return { success: false, error: `Could not hold the plot: ${holdErr.message}` }
  }

  revalidatePath('/bookings')
  revalidatePath(`/inventory/${projectId}`)
  return { success: true, id: data.id }
}

// ── Approve booking ───────────────────────────────────────────

export async function approveBooking(bookingId: string, notes?: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: booking } = await auth.supabase
    .from('bookings')
    .select('plot_id, project_id, client_id, advisor_id, broker_id, broker_commission_pct, broker_commission_amount, total_sale_value, status')
    .eq('id', bookingId).single()

  if (!booking) return { success: false, error: 'Booking not found' }
  if (booking.status !== 'pending_approval') return { success: false, error: 'Booking is not pending approval' }

  // 1. Confirm booking
  const { error: bookingError } = await auth.supabase.from('bookings').update({
    status:       'confirmed',
    approved_by:  auth.userId,
    approved_at:  new Date().toISOString(),
    approval_notes: notes ?? null,
    updated_at:   new Date().toISOString(),
  }).eq('id', bookingId)

  if (bookingError) return { success: false, error: bookingError.message }

  // 2. Mark plot as booked
  const { error: plotError } = await auth.supabase.from('plots').update({
    status:              'booked',
    held_by:             null,
    held_until:          null,
    booked_by_client_id: booking.client_id,
    booking_date:        new Date().toISOString().split('T')[0],
    updated_at:          new Date().toISOString(),
  }).eq('id', booking.plot_id)
  if (plotError) {
    // Don't leave a confirmed booking on a plot that still shows as held/available.
    await auth.supabase.from('bookings').update({ status: 'pending_approval', approved_by: null, approved_at: null, updated_at: new Date().toISOString() }).eq('id', bookingId)
    return { success: false, error: `Could not mark the plot as booked: ${plotError.message}` }
  }

  // 3. Update lead to closed_won if linked
  const { data: client } = await auth.supabase
    .from('clients').select('lead_id').eq('id', booking.client_id).single()
  if (client?.lead_id) {
    const { data: leadBefore } = await auth.supabase.from('leads').select('stage').eq('id', client.lead_id).single()
    await auth.supabase.from('leads').update({
      stage:      'closed_won',
      loss_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('id', client.lead_id)
    if (leadBefore && leadBefore.stage !== 'closed_won') {
      await auth.supabase.from('lead_activities').insert({
        lead_id: client.lead_id, type: 'stage_change', stage_from: leadBefore.stage, stage_to: 'closed_won',
        notes: 'Booking approved — lead marked closed won', performed_by: auth.userId,
      })
    }
  }

  // 4. Create broker commission record
  if (booking.broker_id && booking.broker_commission_amount) {
    await auth.supabase.from('broker_commissions').insert({
      broker_id:         booking.broker_id,
      booking_id:        bookingId,
      booking_value:     booking.total_sale_value,
      commission_pct:    booking.broker_commission_pct,
      commission_amount: booking.broker_commission_amount,
      status:            'pending',
    })
  }

  // Fire booking_created automation
  const { data: clientData } = await auth.supabase.from('clients').select('full_name, phone').eq('id', booking.client_id).single()
  fireAutomations('booking_created', {
    booking: { id: bookingId, booking_date: new Date().toISOString().split('T')[0], project_id: booking.project_id },
    client: clientData ? { id: booking.client_id, full_name: clientData.full_name, phone: clientData.phone } : undefined,
  }, 'booking', bookingId)

  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/inventory/${booking.project_id}`)
  return { success: true }
}

// ── Reject booking ────────────────────────────────────────────

export async function rejectBooking(bookingId: string, reason: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: booking } = await auth.supabase
    .from('bookings').select('plot_id, project_id, status').eq('id', bookingId).single()
  if (!booking) return { success: false, error: 'Booking not found' }
  // Rejecting a confirmed or already-cancelled booking used to free the plot even if another
  // booking now owned it. Use "Cancel booking" for confirmed ones.
  if (booking.status !== 'pending_approval') {
    return { success: false, error: 'Only a booking that is pending approval can be rejected — use Cancel for a confirmed booking' }
  }

  // Release the plot back to available
  await auth.supabase.from('plots').update({
    status:     'available',
    held_by:    null,
    held_until: null,
    updated_at: new Date().toISOString(),
  }).eq('id', booking.plot_id)

  const { error } = await auth.supabase.from('bookings').update({
    status:             'cancelled',
    cancellation_reason: reason,
    cancellation_date:  new Date().toISOString().split('T')[0],
    approved_by:        auth.userId,
    approved_at:        new Date().toISOString(),
    approval_notes:     reason,
    updated_at:         new Date().toISOString(),
  }).eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/inventory/${booking.project_id}`)
  return { success: true }
}

// ── Cancel booking ────────────────────────────────────────────

export async function cancelBooking(bookingId: string, formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: booking } = await auth.supabase
    .from('bookings').select('plot_id, project_id, broker_id, status').eq('id', bookingId).single()
  if (!booking) return { success: false, error: 'Booking not found' }
  if (booking.status === 'cancelled') return { success: false, error: 'Already cancelled' }

  // Reset plot to available
  await auth.supabase.from('plots').update({
    status:              'available',
    held_by:             null,
    held_until:          null,
    booked_by_client_id: null,
    booking_date:        null,
    updated_at:          new Date().toISOString(),
  }).eq('id', booking.plot_id)

  // Void commission if any — but never one that has already been paid out.
  if (booking.broker_id) {
    await auth.supabase.from('broker_commissions').update({ status: 'voided', updated_at: new Date().toISOString() })
      .eq('booking_id', bookingId).in('status', ['pending', 'approved'])
  }

  // The remaining installments no longer fall due; left as pending they kept producing
  // overdue reminders to the client (and showed as receivables).
  await auth.supabase.from('payments')
    .update({ status: 'waived', notes: 'Booking cancelled', updated_at: new Date().toISOString() })
    .eq('booking_id', bookingId).in('status', ['pending', 'overdue'])

  const { error } = await auth.supabase.from('bookings').update({
    status:               'cancelled',
    cancellation_reason:  formData.get('reason') as string,
    cancellation_date:    new Date().toISOString().split('T')[0],
    cancellation_charges: parseFloat(formData.get('cancellation_charges') as string) || null,
    updated_at:           new Date().toISOString(),
  }).eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/bookings')
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/inventory/${booking.project_id}`)
  return { success: true }
}

// ── Payment schedule ──────────────────────────────────────────

export async function addBookingInstallment(formData: FormData) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const bookingId = formData.get('booking_id') as string
  const clientId  = formData.get('client_id') as string

  const { count } = await auth.supabase
    .from('payments').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId)

  const { error } = await auth.supabase.from('payments').insert({
    booking_id:         bookingId,
    client_id:          clientId,
    installment_number: (count ?? 0) + 1,
    description:        formData.get('description') as string || null,
    amount_due:         parseFloat(formData.get('amount_due') as string),
    due_date:           formData.get('due_date') as string,
    status:             'pending',
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/bookings/${bookingId}`)
  return { success: true }
}

export async function deleteBookingInstallment(paymentId: string, bookingId: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: payment } = await auth.supabase
    .from('payments').select('status').eq('id', paymentId).single()
  if (payment?.status === 'paid') return { success: false, error: 'Cannot delete a paid installment' }

  const { error } = await auth.supabase.from('payments').delete().eq('id', paymentId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/bookings/${bookingId}`)
  return { success: true }
}

// ── Document management ───────────────────────────────────────

export async function markAllotmentLetterSent(bookingId: string, url?: string) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('bookings').update({
    allotment_letter_url:     url ?? null,
    allotment_letter_sent_at: new Date().toISOString(),
    updated_at:               new Date().toISOString(),
  }).eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/bookings/${bookingId}`)
  return { success: true }
}

export async function uploadAgreement(bookingId: string, url: string, signed: boolean) {
  const auth = await getAuth()
  if (!auth.ok || !isManager(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('bookings').update({
    agreement_url:    url,
    agreement_signed: signed,
    agreement_date:   signed ? new Date().toISOString().split('T')[0] : null,
    updated_at:       new Date().toISOString(),
  }).eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/bookings/${bookingId}`)
  return { success: true }
}
