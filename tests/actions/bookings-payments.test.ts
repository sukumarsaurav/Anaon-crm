import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { createBooking, approveBooking, rejectBooking, cancelBooking, addBookingInstallment, deleteBookingInstallment } from '@/lib/bookings/actions'
import { recordPayment, waivePayment, createComplaint, assignComplaint, updateComplaintStatus, verifyClientDocument } from '@/lib/clients/actions'
import { softHoldPlot, releaseHold } from '@/lib/inventory/actions'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
// One active booking per plot — the unique index in the database (migration 20261020110000).
const uniqueActiveBooking = (table: string, op: string, rows: any[], db: any) =>
  table === 'bookings' && op === 'insert' && db.rows('bookings').some((b: any) => b.plot_id === rows[0].plot_id && b.status !== 'cancelled')
    ? { message: 'duplicate key value violates unique constraint "bookings_one_active_per_plot"', code: '23505' } : null

const seed = () => ({
  plots: [{ id: 'P1', project_id: 'PR', status: 'available', held_by: null, held_until: null }, { id: 'P2', project_id: 'PR', status: 'soft_hold', held_by: 'adv-a', held_until: '2030-01-01T00:00:00Z' }],
  projects: [{ id: 'PR', hold_duration_hours: 48, max_holds_per_advisor: 2 }],
  clients: [{ id: 'C1', full_name: 'Sita', phone: '9810001025', lead_id: 'L1' }],
  leads: [{ id: 'L1', stage: 'negotiation', loss_reason: 'x' }],
  brokers: [{ id: 'B1', commission_rate: 2 }],
  bookings: [], payments: [], broker_commissions: [], lead_activities: [], plot_holds_log: [],
})

describe('plot holds', () => {
  beforeEach(() => resetWorld(seed(), {}, 'sales_advisor', 'adv-a'))

  it('soft hold claims an available plot with an expiry and writes the hold log', async () => {
    const r: any = await softHoldPlot('P1', 'L1')
    expect(r.success).toBe(true)
    expect(world.db.rows('plots')[0]).toMatchObject({ status: 'soft_hold', held_by: 'adv-a' })
    expect(new Date(world.db.rows('plots')[0].held_until).getTime()).toBeGreaterThan(Date.now() + 47 * 3600_000)
    expect(world.db.rows('plot_holds_log')).toHaveLength(1)
  })
  it('cannot hold a plot that is not available', async () => {
    expect((await softHoldPlot('P2')).success).toBe(false)
  })
  it('enforces the per-advisor hold limit', async () => {
    world.db.rows('plots').push({ id: 'P3', project_id: 'PR', status: 'soft_hold', held_by: 'adv-a' }, { id: 'P4', project_id: 'PR', status: 'soft_hold', held_by: 'adv-a' })
    const r: any = await softHoldPlot('P1')
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/maximum of 2/)
  })
  it('only the holder or a manager can release', async () => {
    resetWorld(seed(), {}, 'sales_advisor', 'someone-else')
    expect((await releaseHold('P2')).success).toBe(false)
    resetWorld(seed(), {}, 'manager', 'mgr')
    expect((await releaseHold('P2')).success).toBe(true)
    expect(world.db.rows('plots')[1]).toMatchObject({ status: 'available', held_by: null, held_until: null })
  })
  it('a plot with a booking awaiting approval cannot be released by hand', async () => {
    world.db.rows('bookings').push({ id: 'BK', plot_id: 'P2', status: 'pending_approval' })
    const r: any = await releaseHold('P2')
    expect(r.success).toBe(false)
    expect(world.db.rows('plots')[1].status).toBe('soft_hold')
  })
})

describe('booking lifecycle', () => {
  beforeEach(() => resetWorld(seed(), { beforeWrite: uniqueActiveBooking }, 'sales_advisor', 'adv-a'))
  const book = (plot = 'P1', extra: Record<string, string> = {}) => createBooking(fd({ plot_id: plot, project_id: 'PR', client_id: 'C1', total_sale_value: '1000000', booking_amount: '100000', ...extra }))

  it('creates a pending booking and holds the plot WITHOUT an expiry (so the hold release cannot free it)', async () => {
    const r: any = await book()
    expect(r.success).toBe(true)
    expect(world.db.rows('bookings')[0]).toMatchObject({ status: 'pending_approval', advisor_id: 'adv-a' })
    expect(world.db.rows('plots')[0]).toMatchObject({ status: 'soft_hold', held_by: 'adv-a', held_until: null })
  })
  it('keeps an existing hold open-ended when booking a plot you already hold', async () => {
    world.db.rows('plots')[1].held_by = 'adv-a'
    expect(((await book('P2')) as any).success).toBe(true)
    expect(world.db.rows('plots')[1].held_until).toBeNull()
  })
  it("another advisor's hold blocks a non-manager but not a manager", async () => {
    resetWorld(seed(), { beforeWrite: uniqueActiveBooking }, 'sales_advisor', 'adv-b')
    expect(((await book('P2')) as any).success).toBe(false)
    resetWorld(seed(), { beforeWrite: uniqueActiveBooking }, 'manager', 'mgr')
    expect(((await book('P2')) as any).success).toBe(true)
  })
  it('refuses a plot that is booked, and a second booking on the same plot (unique index)', async () => {
    world.db.rows('plots')[0].status = 'booked'
    expect(((await book()) as any).success).toBe(false)
    world.db.rows('plots')[0].status = 'available'
    expect(((await book()) as any).success).toBe(true)
    world.db.rows('plots')[0].status = 'available' // simulate a stale read
    const r: any = await book()
    expect(r).toMatchObject({ success: false, error: 'This plot already has an active booking' })
  })
  it('calculates broker commission from the broker rate', async () => {
    await book('P1', { broker_id: 'B1' })
    expect(world.db.rows('bookings')[0]).toMatchObject({ broker_commission_pct: 2, broker_commission_amount: 20000 })
  })

  it('approve: confirms, books the plot, closes the lead with a timeline entry, creates the commission, fires booking_created', async () => {
    await book('P1', { broker_id: 'B1' })
    resetWorldKeepingData('manager')
    const id = world.db.rows('bookings')[0].id
    const r: any = await approveBooking(id, 'ok')
    expect(r.success).toBe(true)
    expect(world.db.rows('bookings')[0]).toMatchObject({ status: 'confirmed', approved_by: 'mgr' })
    expect(world.db.rows('plots')[0]).toMatchObject({ status: 'booked', held_by: null, booked_by_client_id: 'C1' })
    expect(world.db.rows('leads')[0]).toMatchObject({ stage: 'closed_won', loss_reason: null })
    expect(world.db.rows('lead_activities')[0]).toMatchObject({ stage_from: 'negotiation', stage_to: 'closed_won' })
    expect(world.db.rows('broker_commissions')[0]).toMatchObject({ status: 'pending', commission_amount: 20000, booking_id: id })
    expect(world.automations[0].trigger).toBe('booking_created')
  })
  it('approve is manager-only and only for pending bookings', async () => {
    await book()
    const id = world.db.rows('bookings')[0].id
    expect(((await approveBooking(id)) as any).success).toBe(false) // advisor
    resetWorldKeepingData('manager')
    expect(((await approveBooking(id)) as any).success).toBe(true)
    expect(((await approveBooking(id)) as any).success).toBe(false) // already confirmed
  })
  it('approve rolls back the booking if the plot cannot be updated', async () => {
    await book()
    const id = world.db.rows('bookings')[0].id
    resetWorldKeepingData('manager', { beforeWrite: (t: string, op: string) => (t === 'plots' && op === 'update' ? { message: 'boom' } : null) })
    const r: any = await approveBooking(id)
    expect(r.success).toBe(false)
    expect(world.db.rows('bookings')[0].status).toBe('pending_approval')
  })
  it('reject releases the plot, but only for a pending booking', async () => {
    await book()
    const id = world.db.rows('bookings')[0].id
    resetWorldKeepingData('manager')
    expect(((await rejectBooking(id, 'bad docs')) as any).success).toBe(true)
    expect(world.db.rows('plots')[0].status).toBe('available')
    expect(world.db.rows('bookings')[0]).toMatchObject({ status: 'cancelled', cancellation_reason: 'bad docs' })
    // Rejecting an already-cancelled booking must not free the plot again.
    world.db.rows('plots')[0].status = 'booked'
    expect(((await rejectBooking(id, 'again')) as any).success).toBe(false)
    expect(world.db.rows('plots')[0].status).toBe('booked')
  })
  it('cancel: frees the plot, waives unpaid installments, voids only unpaid commission', async () => {
    await book('P1', { broker_id: 'B1' })
    const id = world.db.rows('bookings')[0].id
    world.db.rows('bookings')[0].status = 'confirmed'
    world.db.rows('plots')[0].status = 'booked'
    world.db.rows('payments').push({ id: 'pp', booking_id: id, status: 'paid', amount_due: 1, amount_paid: 1 }, { id: 'pn', booking_id: id, status: 'pending', amount_due: 5 }, { id: 'po', booking_id: id, status: 'overdue', amount_due: 5 })
    world.db.rows('broker_commissions').push({ id: 'c-paid', booking_id: id, status: 'paid' }, { id: 'c-pend', booking_id: id, status: 'pending' })
    resetWorldKeepingData('manager')
    const r: any = await cancelBooking(id, fd({ reason: 'client request', cancellation_charges: '5000' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('plots')[0]).toMatchObject({ status: 'available', booked_by_client_id: null })
    expect(world.db.rows('payments').map((p) => p.status)).toEqual(['paid', 'waived', 'waived'])
    expect(world.db.rows('broker_commissions').map((c) => c.status)).toEqual(['paid', 'voided'])
    expect(world.db.rows('bookings')[0]).toMatchObject({ status: 'cancelled', cancellation_charges: 5000 })
    expect(((await cancelBooking(id, fd({ reason: 'x' }))) as any).error).toBe('Already cancelled')
  })
  it('installments: numbered sequentially; a paid one cannot be deleted', async () => {
    resetWorld({ ...seed(), payments: [] }, {}, 'manager', 'mgr')
    await addBookingInstallment(fd({ booking_id: 'BK', client_id: 'C1', amount_due: '1000', due_date: '2030-01-01' }))
    await addBookingInstallment(fd({ booking_id: 'BK', client_id: 'C1', amount_due: '2000', due_date: '2030-02-01' }))
    expect(world.db.rows('payments').map((p) => p.installment_number)).toEqual([1, 2])
    world.db.rows('payments')[0].status = 'paid'
    expect(((await deleteBookingInstallment(world.db.rows('payments')[0].id, 'BK')) as any).success).toBe(false)
    expect(((await deleteBookingInstallment(world.db.rows('payments')[1].id, 'BK')) as any).success).toBe(true)
  })
})

// Re-run the next action as another user without losing the data built so far.
function resetWorldKeepingData(role: string, opts: any = { beforeWrite: uniqueActiveBooking }) {
  const tables = JSON.parse(JSON.stringify(world.db.tables))
  resetWorld(tables, opts, role, 'mgr')
}

describe('payments', () => {
  const pay = (over: any = {}) => ({ id: 'PAY', booking_id: 'BK', client_id: 'C1', amount_due: 100000, amount_paid: 0, status: 'pending', installment_number: 1, ...over })
  beforeEach(() => resetWorld({ payments: [pay()], clients: [{ id: 'C1', full_name: 'Sita', phone: '9810001025' }] }, {}, 'manager', 'mgr'))

  it('a full payment marks the installment paid, verifies it and fires payment_received', async () => {
    const r: any = await recordPayment('PAY', fd({ amount_paid: '100000', paid_date: '2026-10-20', mode: 'neft', transaction_id: 'T1' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('payments')[0]).toMatchObject({ status: 'paid', amount_paid: 100000, verified_by: 'mgr', mode: 'neft' })
    expect(world.automations[0].trigger).toBe('payment_received')
  })
  it('a part payment leaves the installment open for the balance, and later payments accumulate', async () => {
    await recordPayment('PAY', fd({ amount_paid: '40000', paid_date: '2026-10-20' }))
    expect(world.db.rows('payments')[0]).toMatchObject({ status: 'pending', amount_paid: 40000 })
    await recordPayment('PAY', fd({ amount_paid: '60000', paid_date: '2026-10-25' }))
    expect(world.db.rows('payments')[0]).toMatchObject({ status: 'paid', amount_paid: 100000 })
  })
  it('rejects zero/negative amounts, already-paid and waived installments', async () => {
    expect(((await recordPayment('PAY', fd({ amount_paid: '0' }))) as any).success).toBe(false)
    expect(((await recordPayment('PAY', fd({ amount_paid: '-5' }))) as any).success).toBe(false)
    world.db.rows('payments')[0].status = 'paid'
    expect(((await recordPayment('PAY', fd({ amount_paid: '5' }))) as any).error).toMatch(/already fully paid/)
    world.db.rows('payments')[0].status = 'waived'
    expect(((await recordPayment('PAY', fd({ amount_paid: '5' }))) as any).error).toMatch(/waived/)
  })
  it('only managers record payments', async () => {
    resetWorld({ payments: [pay()] }, {}, 'sales_advisor')
    expect(((await recordPayment('PAY', fd({ amount_paid: '1' }))) as any).success).toBe(false)
  })
  it('an unknown installment fails cleanly', async () => {
    expect(((await recordPayment('nope', fd({ amount_paid: '1' }))) as any).success).toBe(false)
  })
  it('waiving a PAID installment is refused (it would erase received money from the books)', async () => {
    world.db.rows('payments')[0].status = 'paid'
    expect(((await waivePayment('PAY')) as any).success).toBe(false)
    expect(world.db.rows('payments')[0].status).toBe('paid')
  })
  it('waiving an open installment works', async () => {
    expect(((await waivePayment('PAY')) as any).success).toBe(true)
    expect(world.db.rows('payments')[0].status).toBe('waived')
  })
})

describe('complaints and KYC documents', () => {
  beforeEach(() => resetWorld({ complaints: [], clients: [{ id: 'C1', full_name: 'Sita', phone: '9810001025' }], client_documents: [{ id: 'D', client_id: 'C1', status: 'uploaded' }] }, {}, 'manager', 'mgr'))
  it('raising a complaint fires complaint_raised', async () => {
    await createComplaint(fd({ client_id: 'C1', category: 'construction', description: 'delay' }))
    expect(world.db.rows('complaints')[0]).toMatchObject({ status: 'open', priority: 'normal' })
    expect(world.automations[0].trigger).toBe('complaint_raised')
  })
  it('assign moves it to in_progress; resolve records time, notes and rating; reopening clears the resolved time', async () => {
    await createComplaint(fd({ client_id: 'C1', category: 'x', description: 'd' }))
    const id = world.db.rows('complaints')[0].id
    await assignComplaint(id, 'adv')
    expect(world.db.rows('complaints')[0]).toMatchObject({ assigned_to: 'adv', status: 'in_progress' })
    await updateComplaintStatus(id, 'resolved', 'fixed', 5)
    expect(world.db.rows('complaints')[0]).toMatchObject({ status: 'resolved', resolution_notes: 'fixed', satisfaction_rating: 5 })
    expect(world.db.rows('complaints')[0].resolved_at).toBeTruthy()
    await updateComplaintStatus(id, 'in_progress')
    expect(world.db.rows('complaints')[0].resolved_at ?? null).toBeNull()
  })
  it('only managers verify documents', async () => {
    resetWorld({ client_documents: [{ id: 'D', client_id: 'C1' }] }, {}, 'sales_advisor')
    expect(((await verifyClientDocument('D', 'verified')) as any).success).toBe(false)
  })
})
