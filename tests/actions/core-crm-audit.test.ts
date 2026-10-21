import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { changeLeadStage, logActivity, mergeDuplicate } from '@/lib/leads/actions'
import { checkDuplicate } from '@/lib/leads/queries'
import { getClients } from '@/lib/clients/queries'
import { cancelBooking, createBooking, deleteBookingInstallment, addBookingInstallment } from '@/lib/bookings/actions'

/** Regressions for docs/CORE_CRM_AUDIT_2026-10-21.md. */

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const lead = (id: string, extra: Record<string, unknown> = {}) => ({ id, full_name: id, phone: '98100000' + id.slice(-2).padStart(2, '0'), stage: 'contacted', is_active: true, score: 0, created_at: '2026-10-01T00:00:00Z', ...extra })

describe('single-lead stage change (L5)', () => {
  beforeEach(() => resetWorld({ leads: [lead('L1')], lead_activities: [] }, {}, 'sales_advisor'))

  it('refuses Closed Won', async () => {
    expect((await changeLeadStage('L1', 'closed_won')).success).toBe(false)
    expect(world.db.rows('leads')[0].stage).toBe('contacted')
  })
  it('needs a loss reason for Not Interested', async () => {
    expect((await changeLeadStage('L1', 'not_interested')).success).toBe(false)
    expect((await changeLeadStage('L1', 'not_interested', undefined, 'Budget mismatch')).success).toBe(true)
    expect(world.db.rows('leads')[0]).toMatchObject({ stage: 'not_interested', loss_reason: 'Budget mismatch' })
  })
  it('does not log a change when the stage is the same', async () => {
    await changeLeadStage('L1', 'contacted')
    expect(world.db.rows('lead_activities')).toHaveLength(0)
  })
})

describe('logging a contact completes a past-due follow-up (L7)', () => {
  const past = '2026-01-01T00:00:00Z'
  const future = '2099-01-01T00:00:00Z'

  it('clears a past follow-up after a call', async () => {
    resetWorld({ leads: [lead('L1', { next_followup_at: past, follow_up_count: 0 })], lead_activities: [] }, {}, 'sales_advisor')
    expect((await logActivity(fd({ lead_id: 'L1', type: 'call', outcome: 'interested', notes: 'spoke' }))).success).toBe(true)
    expect(world.db.rows('leads')[0].next_followup_at).toBeNull()
  })
  it('keeps a future follow-up, and a note does not count as contact', async () => {
    resetWorld({ leads: [lead('L1', { next_followup_at: future }), lead('L2', { next_followup_at: past })], lead_activities: [] }, {}, 'sales_advisor')
    await logActivity(fd({ lead_id: 'L1', type: 'call', notes: 'x' }))
    await logActivity(fd({ lead_id: 'L2', type: 'note', notes: 'x' }))
    expect(world.db.rows('leads').map((l) => l.next_followup_at)).toEqual([future, past])
  })
})

describe('duplicate check (L3)', () => {
  it('matches a formatted stored phone from the typed digits', async () => {
    resetWorld({ leads: [lead('L1', { phone: '+91-9810001025' }), lead('L2', { phone: '9999999999' })] }, {}, 'sales_advisor')
    const r = await checkDuplicate('+91 98100 01025')
    expect(r.found).toBe(true)
    expect(r.leads.map((l) => l.id)).toEqual(['L1'])
  })
  it('finds nothing for a new number', async () => {
    resetWorld({ leads: [lead('L1', { phone: '+91-9810001025' })] }, {}, 'sales_advisor')
    expect((await checkDuplicate('9810001026')).found).toBe(false)
  })
})

describe('merge (L2)', () => {
  it('refuses when both leads already have a client', async () => {
    resetWorld({
      leads: [lead('K1'), lead('D1')], lead_activities: [{ id: 'a', lead_id: 'D1' }],
      clients: [{ id: 'c1', lead_id: 'K1' }, { id: 'c2', lead_id: 'D1' }],
    }, {}, 'admin')
    expect((await mergeDuplicate('K1', 'D1')).success).toBe(false)
    expect(world.db.rows('lead_activities')[0].lead_id).toBe('D1')
  })
})

describe('client search (C1)', () => {
  it('handles a comma and a formatted phone', async () => {
    resetWorld({ clients: [{ id: 'c1', full_name: 'Sharma, Rahul', phone: '+91-9810001025', created_at: '2026-10-01' }] }, {}, 'admin')
    expect((await getClients({ search: 'Sharma, Rahul' })).clients).toHaveLength(1)
    expect((await getClients({ search: '98100 01025' })).clients).toHaveLength(1)
  })
})

describe('bookings (B1, B3, B4)', () => {
  it('cancelling a confirmed booking takes the lead off Closed Won', async () => {
    resetWorld({
      bookings: [{ id: 'B1', status: 'confirmed', plot_id: 'P1', project_id: 'PR', client_id: 'C1', broker_id: null }],
      plots: [{ id: 'P1', status: 'booked' }], payments: [], broker_commissions: [], audit_logs: [], lead_activities: [],
      clients: [{ id: 'C1', lead_id: 'L1' }], leads: [lead('L1', { stage: 'closed_won' })],
    }, {}, 'manager')
    expect((await cancelBooking('B1', fd({ reason: 'Client withdrew' }))).success).toBe(true)
    expect(world.db.rows('leads')[0]).toMatchObject({ stage: 'not_interested', loss_reason: 'Booking cancelled' })
  })
  it('keeps the lead won when another confirmed booking remains', async () => {
    resetWorld({
      bookings: [
        { id: 'B1', status: 'confirmed', plot_id: 'P1', project_id: 'PR', client_id: 'C1', broker_id: null },
        { id: 'B2', status: 'confirmed', plot_id: 'P2', project_id: 'PR', client_id: 'C1', broker_id: null },
      ],
      plots: [{ id: 'P1', status: 'booked' }], payments: [], broker_commissions: [], audit_logs: [], lead_activities: [],
      clients: [{ id: 'C1', lead_id: 'L1' }], leads: [lead('L1', { stage: 'closed_won' })],
    }, {}, 'manager')
    await cancelBooking('B1', fd({ reason: 'Swapped plot' }))
    expect(world.db.rows('leads')[0].stage).toBe('closed_won')
  })
  it('will not delete a part-paid installment; numbering is max + 1', async () => {
    resetWorld({
      payments: [
        { id: 'p1', booking_id: 'B1', installment_number: 1, status: 'pending', amount_paid: 5000 },
        { id: 'p3', booking_id: 'B1', installment_number: 3, status: 'pending', amount_paid: 0 },
      ],
      audit_logs: [],
    }, {}, 'manager')
    expect((await deleteBookingInstallment('p1', 'B1')).success).toBe(false)
    await addBookingInstallment(fd({ booking_id: 'B1', client_id: 'C1', amount_due: '100', due_date: '2026-12-01' }))
    expect(world.db.rows('payments').map((p) => p.installment_number)).toEqual([1, 3, 4])
  })
  it('takes the project from the plot and rejects missing amounts', async () => {
    resetWorld({
      plots: [{ id: 'P1', status: 'available', held_by: null, project_id: 'REAL', project: { name: 'A', rera_expiry_date: null } }],
      clients: [{ id: 'C1' }], bookings: [],
    }, {}, 'manager')
    expect((await createBooking(fd({ plot_id: 'P1', project_id: 'REAL', client_id: 'C1' }))).success).toBe(false)
    const r = await createBooking(fd({ plot_id: 'P1', project_id: 'FAKE', client_id: 'C1', total_sale_value: '1000000', booking_amount: '100000' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('bookings')[0].project_id).toBe('REAL')
  })
})
