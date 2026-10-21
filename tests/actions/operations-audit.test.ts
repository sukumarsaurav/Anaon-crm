import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { applyLeave, checkIn, checkOut, reviewLeave, cancelLeave, updateMemberProfile } from '@/lib/team/actions'
import { updateStaffProfile, setStaffActive } from '@/lib/team/staff'
import { addCandidate } from '@/lib/hr/actions'
import { leaveWorkingDates } from '@/lib/hr/leave'
import { computeSlip } from '@/lib/hr/payroll'
import { submitDeletionRequest } from '@/lib/legal/actions'
import { nextQuarterlyDue, reraExpired } from '@/lib/legal/rera'
import { createBooking } from '@/lib/bookings/actions'
import { getConsentStats } from '@/lib/legal/queries'
import { getMonthlyKPI } from '@/lib/team/queries'
import { todayIST } from '@/lib/datetime'

/** Regressions for docs/OPERATIONS_AUDIT_2026-10-21.md (Team, HR, Automation, Legal). */

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }

describe('leave', () => {
  beforeEach(() => resetWorld({ leave_requests: [], hr_leave_balances: [], attendance_logs: [] }, {}, 'sales_advisor', 'adv'))

  it('counts working days only (Sundays are off)', async () => {
    expect(leaveWorkingDates('2026-10-03', '2026-10-05')).toEqual(['2026-10-03', '2026-10-05']) // Sat, (Sun), Mon
    expect((await applyLeave(fd({ leave_type: 'casual', from_date: '2026-10-03', to_date: '2026-10-05' }))).success).toBe(true)
    expect(world.db.rows('leave_requests')[0]).toMatchObject({ days_count: 2, status: 'pending' })
  })
  it('refuses an unknown type, a Sunday-only range and overlapping requests', async () => {
    expect((await applyLeave(fd({ leave_type: 'sabbatical', from_date: '2026-10-05', to_date: '2026-10-05' }))).success).toBe(false)
    expect((await applyLeave(fd({ leave_type: 'casual', from_date: '2026-10-04', to_date: '2026-10-04' }))).success).toBe(false)
    await applyLeave(fd({ leave_type: 'casual', from_date: '2026-10-05', to_date: '2026-10-07' }))
    const again = await applyLeave(fd({ leave_type: 'sick', from_date: '2026-10-07', to_date: '2026-10-08' }))
    expect(again).toMatchObject({ success: false })
    expect(world.db.rows('leave_requests')).toHaveLength(1)
  })
  it('accepts maternity, paternity and comp-off (one list for Team and HR)', async () => {
    for (const t of ['maternity', 'paternity', 'comp_off']) {
      resetWorld({ leave_requests: [] }, {}, 'sales_advisor', 'adv')
      expect((await applyLeave(fd({ leave_type: t, from_date: '2026-10-05', to_date: '2026-10-05' }))).success).toBe(true)
    }
  })
  it('approving marks the days on leave (not a day already checked in) and counts the balance', async () => {
    resetWorld({
      leave_requests: [{ id: 'l1', user_id: 'adv', leave_type: 'comp_off', from_date: '2026-10-05', to_date: '2026-10-07', days_count: 3, status: 'pending' }],
      hr_leave_balances: [],
      attendance_logs: [{ id: 'a6', user_id: 'adv', date: '2026-10-06', status: 'present', check_in_at: '2026-10-06T04:00:00Z' }],
    }, {}, 'manager', 'mgr')
    expect((await reviewLeave('l1', true)).success).toBe(true)
    const att = world.db.rows('attendance_logs')
    expect(att.find((a) => a.date === '2026-10-05')?.status).toBe('on_leave')
    expect(att.find((a) => a.date === '2026-10-06')?.status).toBe('present')
    expect(att.find((a) => a.date === '2026-10-07')?.status).toBe('on_leave')
    expect(world.db.rows('hr_leave_balances')[0]).toMatchObject({ leave_type: 'comp_off', used: 3, year: 2026 })
  })
  it('nobody reviews their own request; withdrawing only works while pending', async () => {
    resetWorld({ leave_requests: [{ id: 'l1', user_id: 'mgr', leave_type: 'casual', from_date: '2026-10-05', to_date: '2026-10-05', days_count: 1, status: 'pending' }] }, {}, 'manager', 'mgr')
    expect((await reviewLeave('l1', true)).success).toBe(false)
    resetWorld({ leave_requests: [{ id: 'l2', user_id: 'adv', status: 'approved' }] }, {}, 'sales_advisor', 'adv')
    expect((await cancelLeave('l2')).success).toBe(false)
  })
})

describe('web check-in', () => {
  const today = todayIST()
  it('does not move an earlier check-in', async () => {
    resetWorld({ attendance_logs: [{ id: 'a', user_id: 'adv', date: today, status: 'present', check_in_at: '2026-10-21T03:30:00Z' }] }, {}, 'sales_advisor', 'adv')
    expect((await checkIn()).success).toBe(false)
    expect(world.db.rows('attendance_logs')[0].check_in_at).toBe('2026-10-21T03:30:00Z')
  })
  it('does not turn a day marked on leave into present', async () => {
    resetWorld({ attendance_logs: [{ id: 'a', user_id: 'adv', date: today, status: 'on_leave', check_in_at: null }] }, {}, 'sales_advisor', 'adv')
    const r = await checkIn()
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/On Leave/)
    expect(world.db.rows('attendance_logs')[0].status).toBe('on_leave')
  })
  it('checks in once and out once', async () => {
    resetWorld({ attendance_logs: [] }, {}, 'sales_advisor', 'adv')
    expect((await checkOut()).success).toBe(false)
    expect((await checkIn(26.9, 75.8)).success).toBe(true)
    expect(world.db.rows('attendance_logs')[0]).toMatchObject({ user_id: 'adv', date: today, status: 'present', check_in_lat: 26.9 })
    expect((await checkOut()).success).toBe(true)
    expect((await checkOut()).success).toBe(false)
  })
})

describe('staff records', () => {
  const people = () => [
    { id: 'mgr', role: 'manager', full_name: 'M', is_active: true, base_salary: 50000 },
    { id: 'e', role: 'sales_advisor', full_name: 'E', email: 'e@x.in', is_active: true, base_salary: 30000, bank_account: null },
  ]
  it('a manager cannot edit their own HR record', async () => {
    resetWorld({ profiles: people() }, {}, 'manager', 'mgr')
    const r = await updateStaffProfile('mgr', fd({ base_salary: '90000' }))
    expect(r.success).toBe(false)
    expect(world.db.rows('profiles')[0].base_salary).toBe(50000)
  })
  it('a manager cannot change salary, bank or login email, but can edit the rest', async () => {
    resetWorld({ profiles: people() }, {}, 'manager', 'mgr')
    expect((await updateStaffProfile('e', fd({ base_salary: '99999' }))).error).toMatch(/Only an admin/)
    expect((await updateStaffProfile('e', fd({ email: 'thief@x.in' }))).error).toMatch(/Only an admin/)
    // Unchanged values on the same form are fine.
    expect((await updateStaffProfile('e', fd({ base_salary: '30000', email: 'e@x.in', designation: 'Senior Advisor' }))).success).toBe(true)
    expect(world.db.rows('profiles')[1]).toMatchObject({ base_salary: 30000, designation: 'Senior Advisor' })
  })
  it('an admin changing the email also changes the login', async () => {
    resetWorld({ profiles: people() }, {}, 'admin', 'adm')
    world.db.users = [{ id: 'e', email: 'e@x.in', app_metadata: {} }] as never
    expect((await updateStaffProfile('e', fd({ email: 'New@X.in' }))).success).toBe(true)
    expect(world.db.rows('profiles')[1].email).toBe('new@x.in')
  })
  it('checks Aadhaar / PAN / IFSC formats', async () => {
    resetWorld({ profiles: people() }, {}, 'admin', 'adm')
    expect((await updateStaffProfile('e', fd({ aadhar_number: '1234' }))).success).toBe(false)
    expect((await updateStaffProfile('e', fd({ pan_number: 'ABC' }))).success).toBe(false)
    expect((await updateStaffProfile('e', fd({ bank_ifsc: 'SBIN1' }))).success).toBe(false)
  })
  it('role changes are refused for a manager before anything is saved', async () => {
    resetWorld({ profiles: people() }, {}, 'manager', 'mgr')
    const r = await updateMemberProfile('e', fd({ designation: 'X', role: 'manager' }))
    expect(r.success).toBe(false)
    expect(world.db.rows('profiles')[1].designation).toBeUndefined()
  })
  it('deactivating a team leader hands their team to the parent team\'s leader', async () => {
    resetWorld({
      profiles: people(),
      teams: [{ id: 'top', leader_id: 'mgr', parent_team_id: null }, { id: 'sub', leader_id: 'e', parent_team_id: 'top' }],
      user_sessions: [],
    }, {}, 'admin', 'adm')
    expect((await setStaffActive('e', false, 'left')).success).toBe(true)
    expect(world.db.rows('teams').find((t) => t.id === 'sub')?.leader_id).toBe('mgr')
  })
})

describe('payroll arithmetic', () => {
  it('pays for days worked; PF on earned basic up to the ceiling; nothing negative', () => {
    expect(computeSlip({ basic: 50000, hra: 20000, allowances: 30000, workingDays: 26, presentDays: 26 }))
      .toMatchObject({ gross: 100000, pf_employee: 1800, total_deductions: 2000, net_pay: 98000 })
    expect(computeSlip({ basic: 5000, hra: 2000, allowances: 3000, workingDays: 26, presentDays: 13 }))
      .toMatchObject({ gross: 5000, pf_employee: 300, lop_days: 13 })
    expect(computeSlip({ basic: 0, hra: 0, allowances: 0, workingDays: 26, presentDays: 0 }))
      .toMatchObject({ gross: 0, professional_tax: 0, net_pay: 0 })
  })
})

describe('recruitment', () => {
  it('candidates can be added by hand (the careers form is gone)', async () => {
    resetWorld({ career_applications: [] }, {}, 'manager')
    expect((await addCandidate(fd({ name: 'Riya' }))).success).toBe(false)
    expect((await addCandidate(fd({ name: 'Riya', phone: '9810001000', expected_ctc: '600000' }))).success).toBe(true)
    expect(world.db.rows('career_applications')[0]).toMatchObject({ stage: 'applied', expected_ctc: 600000 })
  })
})

describe('Team KPIs', () => {
  it('revenue and bookings come from confirmed bookings in the IST month, not lead budgets', async () => {
    resetWorld({
      lead_activities: [
        { id: '1', performed_by: 'a', type: 'call', outcome: 'connected_interested', created_at: '2026-09-30T19:00:00Z' }, // 1 Oct, 00:30 IST
        { id: '2', performed_by: 'a', type: 'whatsapp', created_at: '2026-10-10T05:00:00Z' },
        { id: '3', performed_by: 'a', type: 'call', created_at: '2026-10-31T19:00:00Z' }, // 1 Nov IST
      ],
      site_visits: [{ id: 'v', visited_by: 'a', accompanied_by: null, status: 'completed', scheduled_at: '2026-10-12T06:00:00Z' }],
      bookings: [
        { id: 'b1', advisor_id: 'a', status: 'confirmed', total_sale_value: 4500000, booking_date: '2026-10-15' },
        { id: 'b2', advisor_id: 'a', status: 'cancelled', total_sale_value: 9000000, booking_date: '2026-10-16' },
      ],
      leads: [{ id: 'L', assigned_to: 'a', stage: 'closed_won', budget_max: 99_000_000, updated_at: '2026-10-20T00:00:00Z' }],
      whatsapp_messages: [],
    }, {}, 'admin')
    const k = await getMonthlyKPI('a', 10, 2026)
    expect(k).toMatchObject({ calls_made: 1, connected_calls: 1, followups_completed: 2, site_visits_completed: 1, bookings_done: 1, revenue_generated: 4500000 })
  })
})

describe('DPDP requests', () => {
  it('must point at an existing lead or client', async () => {
    resetWorld({ leads: [{ id: 'L1', full_name: 'Ravi' }], data_deletion_requests: [] }, {}, 'manager')
    expect((await submitDeletionRequest(fd({ requester_type: 'lead', requester_name: 'Ravi' }))).success).toBe(false)
    expect((await submitDeletionRequest(fd({ requester_type: 'lead', requester_id: 'nope', requester_name: 'Ravi' }))).success).toBe(false)
    expect((await submitDeletionRequest(fd({ requester_type: 'lead', requester_id: 'L1', requester_name: 'Ravi' }))).success).toBe(true)
    expect(world.db.rows('data_deletion_requests')[0]).toMatchObject({ requester_type: 'lead', requester_id: 'L1' })
  })
  it('consent stats show each person\'s current choice, not a count of events', async () => {
    resetWorld({ consent_logs: [
      { id: '1', entity_type: 'lead', entity_id: 'L1', consent_type: 'marketing_whatsapp', consented: false, created_at: '2026-10-01T00:00:00Z' },
      { id: '2', entity_type: 'lead', entity_id: 'L1', consent_type: 'marketing_whatsapp', consented: true, created_at: '2026-10-02T00:00:00Z' },
      { id: '3', entity_type: 'lead', entity_id: 'L2', consent_type: 'marketing_whatsapp', consented: false, created_at: '2026-10-02T00:00:00Z' },
    ] }, {}, 'admin')
    expect((await getConsentStats()).marketing_whatsapp).toEqual({ total: 2, opted_in: 1 })
  })
})

describe('RERA', () => {
  it('the quarterly report is due a fixed time after the quarter ends', () => {
    expect(nextQuarterlyDue('2026-10-21')).toBe('2027-01-15')
    expect(nextQuarterlyDue('2026-01-05')).toBe('2026-04-15')
    expect(nextQuarterlyDue('2026-06-30')).toBe('2026-07-15')
  })
  it('no booking on a project whose registration has expired', async () => {
    expect(reraExpired('2026-04-14', '2026-10-21')).toBe(true)
    expect(reraExpired('2026-10-21', '2026-10-21')).toBe(false)
    resetWorld({
      plots: [{ id: 'P1', status: 'available', held_by: null, project: { name: 'Anon Heights', rera_expiry_date: '2026-04-14' } }],
      bookings: [],
    }, {}, 'manager')
    const r = await createBooking(fd({ plot_id: 'P1', project_id: 'X', client_id: 'C', total_sale_value: '1000000', booking_amount: '100000' }))
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/RERA registration expired/)
    expect(world.db.rows('bookings')).toHaveLength(0)
  })
})
