import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { bulkChangeStage, mergeDuplicate } from '@/lib/leads/actions'
import { createClientProfile } from '@/lib/clients/actions'
import { setStaffActive, changeStaffAssignment, updateStaffProfile } from '@/lib/team/staff'
import { addJunior } from '@/lib/team/teams'
import { updatePayrollSlip, setLeaveBalance } from '@/lib/hr/actions'
import { approveBooking } from '@/lib/bookings/actions'
import { getLeadFunnel } from '@/lib/reports/queries'

/** Regressions for docs/MENU_AUDIT_2026-10-20.md. */

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const lead = (id: string, extra: Record<string, unknown> = {}) => ({ id, full_name: id, phone: '98100000' + id.slice(-2).padStart(2, '0'), stage: 'contacted', is_active: true, score: 0, created_at: '2026-10-01T00:00:00Z', ...extra })

describe('bulk stage change', () => {
  beforeEach(() => resetWorld({ leads: [lead('L1'), lead('L2')], lead_activities: [] }, {}, 'manager'))

  it('refuses Closed Won (that comes from an approved booking)', async () => {
    const r = await bulkChangeStage(['L1', 'L2'], 'closed_won')
    expect(r.success).toBe(false)
    expect(world.db.rows('leads').every((l) => l.stage === 'contacted')).toBe(true)
  })
  it('needs a loss reason for Not Interested and stores it', async () => {
    expect((await bulkChangeStage(['L1'], 'not_interested')).success).toBe(false)
    const r = await bulkChangeStage(['L1', 'L2'], 'not_interested', 'Budget mismatch')
    expect(r).toMatchObject({ success: true, count: 2 })
    expect(world.db.rows('leads').map((l) => l.loss_reason)).toEqual(['Budget mismatch', 'Budget mismatch'])
  })
})

describe('merge moves every child record', () => {
  it('re-parents albums, hold log and broadcast recipients too', async () => {
    resetWorld({
      leads: [lead('K1'), lead('D1')], lead_activities: [], site_visits: [], clients: [], whatsapp_conversations: [], broker_lead_registrations: [],
      property_albums: [{ id: 'a', lead_id: 'D1' }], plot_holds_log: [{ id: 'h', lead_id: 'D1' }], whatsapp_broadcast_recipients: [{ id: 'r', lead_id: 'D1' }],
    }, {}, 'admin')
    expect((await mergeDuplicate('K1', 'D1')).success).toBe(true)
    for (const t of ['property_albums', 'plot_holds_log', 'whatsapp_broadcast_recipients']) expect(world.db.rows(t)[0].lead_id).toBe('K1')
  })
})

describe('lead → client conversion', () => {
  beforeEach(() => resetWorld({ leads: [lead('L1')], clients: [], lead_activities: [], audit_logs: [] }, {}, 'sales_advisor', 'adv'))

  it('links the client to the lead and logs it on the timeline', async () => {
    const r = await createClientProfile(fd({ full_name: 'L1', phone: '9810000001', lead_id: 'L1' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('clients')[0].lead_id).toBe('L1')
    expect(world.db.rows('lead_activities')[0].notes).toBe('Converted to client')
  })
  it('refuses converting the same lead twice', async () => {
    await createClientProfile(fd({ full_name: 'L1', phone: '9810000001', lead_id: 'L1' }))
    const again = await createClientProfile(fd({ full_name: 'L1', phone: '9810000001', lead_id: 'L1' }))
    expect(again.success).toBe(false)
    expect(world.db.rows('clients')).toHaveLength(1)
  })
})

describe('staff management', () => {
  const staff = () => resetWorld({
    profiles: [
      { id: 'user-admin', role: 'admin', full_name: 'Admin', is_active: true },
      { id: 'u1', role: 'sales_advisor', full_name: 'Ravi', is_active: true },
      { id: 'boss', role: 'admin', full_name: 'Other admin', is_active: true },
    ],
    user_sessions: [{ id: 's1', user_id: 'u1', is_active: true }], audit_logs: [],
  }, {}, 'admin')

  it('deactivating ends the login: profile inactive, sessions revoked, audited', async () => {
    const db = staff()
    db.users.push({ id: 'u1', email: 'u1@x' })
    expect((await setStaffActive('u1', false, 'left')).success).toBe(true)
    expect(world.db.rows('profiles').find((p) => p.id === 'u1')).toMatchObject({ is_active: false, termination_reason: 'left' })
    expect(world.db.rows('user_sessions')[0].is_active).toBe(false)
    expect(db.users.find((u) => u.id === 'u1')?.banned).toBe(true)
    expect(world.db.rows('audit_logs').some((a) => a.action === 'user_deactivated')).toBe(true)
  })
  it('nobody deactivates themselves', async () => {
    staff()
    expect((await setStaffActive('user-admin', false)).success).toBe(false)
  })
  it('a manager cannot touch an admin or change roles', async () => {
    staff()
    world.session!.profile.role = 'manager'
    expect((await setStaffActive('boss', false)).success).toBe(false)
    expect((await changeStaffAssignment('u1', { role: 'admin' })).success).toBe(false)
  })
  it('stores employee ID numbers encrypted', async () => {
    process.env.PII_ENCRYPTION_KEY = '0'.repeat(64)
    staff()
    expect((await updateStaffProfile('u1', fd({ full_name: 'Ravi', pan_number: 'ABCDE1234F' }))).success).toBe(true)
    expect(String(world.db.rows('profiles').find((p) => p.id === 'u1')!.pan_number)).toMatch(/^enc:v1:/)
  })
})

describe('add member (addJunior) role', () => {
  it('a non-admin leader cannot create an admin or a role above their own', async () => {
    resetWorld({
      teams: [{ id: 't1', name: 'Team', leader_id: 'lead', parent_team_id: null, is_active: true, branch_id: null }],
      profiles: [{ id: 'lead', role: 'sales_advisor', full_name: 'Lead', is_active: true, team_id: 't1' }], audit_logs: [],
    }, {}, 'sales_advisor', 'lead')
    for (const role of ['admin', 'manager']) {
      const r = await addJunior({ target_team_id: 't1', full_name: 'X', email: `${role}@x.com`, role: role as 'manager', mode: 'member' } as never)
      expect(r.success).toBe(false)
    }
    expect((await addJunior({ target_team_id: 't1', full_name: 'Y', email: 'y@x.com', role: 'telecaller', mode: 'member' } as never)).success).toBe(true)
  })
})

describe('payroll slip adjustment', () => {
  const run = (status: string) => resetWorld({
    payroll_runs: [{ id: 'r1', status }],
    payroll_slips: [{ id: 's1', run_id: 'r1', basic: 13000, hra: 5200, allowances: 7800, gross: 26000, total_deductions: 1760, net_pay: 24240, run: { status } }],
  }, {}, 'admin')

  it('recomputes from the salary structure, so re-saving does not deduct twice', async () => {
    run('processing')
    const f = fd({ working_days: '26', present_days: '24', incentives: '0' })
    await updatePayrollSlip('s1', f)
    await updatePayrollSlip('s1', f)
    // 24/26 of 26,000; PF 12% of the earned basic (12,000) = 1,440; PT 200.
    expect(world.db.rows('payroll_slips')[0]).toMatchObject({ lop_days: 2, gross: 24000, total_deductions: 1640, net_pay: 22360 })
  })
  it('refuses a finalized run', async () => {
    run('completed')
    expect((await updatePayrollSlip('s1', fd({ present_days: '20' }))).success).toBe(false)
  })
})

describe('leave entitlement', () => {
  it('sets entitled days and keeps used', async () => {
    resetWorld({ hr_leave_balances: [{ id: 'b1', user_id: 'u1', year: 2026, leave_type: 'casual', entitled: 0, used: 3 }] }, {}, 'admin')
    expect((await setLeaveBalance(fd({ user_id: 'u1', leave_type: 'casual', year: '2026', entitled: '12' }))).success).toBe(true)
    expect(world.db.rows('hr_leave_balances')[0]).toMatchObject({ entitled: 12, used: 3 })
  })
})

describe('booking approval', () => {
  it('creates the booking-amount installment when the schedule is empty', async () => {
    resetWorld({
      bookings: [{ id: 'b1', plot_id: 'p1', project_id: 'pr', client_id: 'c1', status: 'pending_approval', total_sale_value: 1000000, booking_amount: 100000, booking_date: '2026-10-20' }],
      plots: [{ id: 'p1', status: 'soft_hold' }], clients: [{ id: 'c1', full_name: 'C', phone: '1', lead_id: null }], payments: [], broker_commissions: [], audit_logs: [],
    }, {}, 'manager')
    expect((await approveBooking('b1')).success).toBe(true)
    expect(world.db.rows('payments')).toMatchObject([{ booking_id: 'b1', installment_number: 1, amount_due: 100000, description: 'Booking amount' }])
  })
})

describe('lead funnel report', () => {
  it('counts the real lead stages', async () => {
    resetWorld({ leads: [lead('A', { stage: 'new_lead' }), lead('B', { stage: 'token_paid' }), lead('C', { stage: 'closed_won' })] }, {}, 'admin')
    const funnel = await getLeadFunnel()
    const by = Object.fromEntries(funnel.map((f) => [f.stage, f.count]))
    expect(by).toMatchObject({ new_lead: 1, token_paid: 1, closed_won: 1 })
    expect(funnel.map((f) => f.stage)).not.toContain('booked')
  })
})
