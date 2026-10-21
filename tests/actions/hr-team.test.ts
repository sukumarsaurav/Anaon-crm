import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { approveLeave, rejectLeave, setLeaveBalance, createPayrollRun, finalizePayrollRun, updatePayrollSlip, deactivateEmployee } from '@/lib/hr/actions'
import { applyLeave, reviewLeave, cancelLeave, toggleMemberActive, setMonthlyTarget } from '@/lib/team/actions'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const leave = (o: any = {}) => ({ id: 'LV', user_id: 'emp', leave_type: 'casual', days_count: 3, from_date: '2026-11-02', to_date: '2026-11-04', status: 'pending', ...o })

describe('leave', () => {
  beforeEach(() => resetWorld({ leave_requests: [leave()], hr_leave_balances: [{ id: 'bal', user_id: 'emp', year: 2026, leave_type: 'casual', entitled: 12, used: 2 }] }, {}, 'manager', 'mgr'))

  it('approving records the decision and DEDUCTS the days from the balance', async () => {
    expect(((await approveLeave('LV', 'enjoy')) as any).success).toBe(true)
    expect(world.db.rows('leave_requests')[0]).toMatchObject({ status: 'approved', reviewed_by: 'mgr', review_note: 'enjoy' })
    expect(world.db.rows('hr_leave_balances')[0].used).toBe(5)
  })
  it('creates a balance row when none exists yet', async () => {
    world.db.tables.hr_leave_balances = []
    await approveLeave('LV')
    expect(world.db.rows('hr_leave_balances')[0]).toMatchObject({ user_id: 'emp', leave_type: 'casual', used: 3 })
  })
  it('a request can be decided once: no re-approving, no flipping a rejection', async () => {
    await rejectLeave('LV', 'busy')
    expect(world.db.rows('leave_requests')[0].status).toBe('rejected')
    expect(((await approveLeave('LV')) as any).error).toMatch(/already rejected/)
    expect(world.db.rows('hr_leave_balances')[0].used).toBe(2)
    world.db.rows('leave_requests')[0].status = 'approved'
    expect(((await approveLeave('LV')) as any).success).toBe(false) // cannot deduct twice
    expect(((await reviewLeave('LV', false)) as any).success).toBe(false)
  })
  it('rejecting does not touch the balance', async () => {
    await rejectLeave('LV', 'no')
    expect(world.db.rows('hr_leave_balances')[0].used).toBe(2)
  })
  it('nobody reviews their own leave', async () => {
    resetWorld({ leave_requests: [leave({ user_id: 'mgr' })], hr_leave_balances: [] }, {}, 'manager', 'mgr')
    expect(((await approveLeave('LV')) as any).error).toMatch(/own leave/)
    expect(((await reviewLeave('LV', true)) as any).error).toMatch(/own leave/)
  })
  it('the Team screen and the HR screen decide the same way', async () => {
    await reviewLeave('LV', true, 'ok')
    expect(world.db.rows('hr_leave_balances')[0].used).toBe(5)
  })
  it('applying validates the dates and counts inclusive days', async () => {
    resetWorld({ leave_requests: [] }, {}, 'sales_advisor', 'emp')
    expect(((await applyLeave(fd({ leave_type: 'casual', from_date: '', to_date: '' }))) as any).success).toBe(false)
    expect(((await applyLeave(fd({ leave_type: 'casual', from_date: '2026-11-05', to_date: '2026-11-01' }))) as any).error).toMatch(/before/)
    await applyLeave(fd({ leave_type: 'casual', from_date: '2026-11-02', to_date: '2026-11-04' }))
    expect(world.db.rows('leave_requests')[0]).toMatchObject({ days_count: 3, status: 'pending', user_id: 'emp' })
    await applyLeave(fd({ leave_type: 'casual', from_date: '2026-11-10', to_date: '2026-11-10' }))
    expect(world.db.rows('leave_requests')[1].days_count).toBe(1)
  })
  it('only the owner can cancel, and only while pending', async () => {
    resetWorld({ leave_requests: [leave({ user_id: 'emp' }), leave({ id: 'LV2', user_id: 'emp', status: 'approved' })] }, {}, 'sales_advisor', 'other')
    await cancelLeave('LV')
    expect(world.db.rows('leave_requests')[0].status).toBe('pending')
    resetWorld({ leave_requests: [leave({ user_id: 'emp' }), leave({ id: 'LV2', user_id: 'emp', status: 'approved' })] }, {}, 'sales_advisor', 'emp')
    await cancelLeave('LV'); await cancelLeave('LV2')
    expect(world.db.rows('leave_requests').map((l) => l.status)).toEqual(['cancelled', 'approved'])
  })
  it('setLeaveBalance upserts per user/year/type', async () => {
    await setLeaveBalance(fd({ user_id: 'emp', leave_type: 'casual', entitled: '15', used: '1' }))
    expect(world.db.rows('hr_leave_balances')).toHaveLength(1) // upserted, not duplicated
  })
})

describe('payroll', () => {
  const people = [
    { id: 'p1', role: 'sales_advisor', is_active: true, base_salary: 40000 },
    { id: 'p2', role: 'manager', is_active: true, base_salary: 100000 },
    { id: 'p3', role: 'telecaller', is_active: false, base_salary: 25000 },
    { id: 'p4', role: 'broker', is_active: true, base_salary: null },
  ]
  beforeEach(() => resetWorld({ profiles: people, payroll_runs: [], payroll_slips: [] }, {}, 'admin', 'adm'))

  it('creates slips for active STAFF only (not leavers, not broker logins) with correct arithmetic', async () => {
    const r: any = await createPayrollRun(fd({ year: '2026', month: '10' }))
    expect(r.success).toBe(true)
    const slips = world.db.rows('payroll_slips')
    expect(slips.map((s) => s.user_id).sort()).toEqual(['p1', 'p2'])
    const s = slips.find((x) => x.user_id === 'p1')!
    // October 2026: 27 working days (Sundays off). PF is 12% of basic up to the ₹15,000 wage ceiling.
    expect(s).toMatchObject({ basic: 20000, hra: 8000, allowances: 12000, gross: 40000, working_days: 27, present_days: 27, pf_employee: 1800, professional_tax: 200, total_deductions: 2000, net_pay: 38000 })
    expect(s.basic + s.hra + s.allowances).toBe(s.gross)
    expect(world.db.rows('payroll_runs')[0]).toMatchObject({ total_employees: 2, total_gross: 140000, status: 'processing' })
    expect(world.db.rows('payroll_runs')[0].total_net).toBe(slips.reduce((a, x) => a + x.net_pay, 0))
  })
  it('one run per month; validates month and year', async () => {
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    expect(((await createPayrollRun(fd({ year: '2026', month: '10' }))) as any).error).toMatch(/already exists/)
    for (const [y, m] of [['2026', '13'], ['2026', '0'], ['abc', '5'], ['1999', '5']]) expect(((await createPayrollRun(fd({ year: y, month: m }))) as any).success).toBe(false)
  })
  it('a failure generating slips does not leave a half-built run behind', async () => {
    resetWorld({ profiles: people, payroll_runs: [], payroll_slips: [] }, { beforeWrite: (t, op) => (t === 'payroll_slips' && op === 'insert' ? { message: 'boom' } : null) }, 'admin', 'adm')
    const r: any = await createPayrollRun(fd({ year: '2026', month: '10' }))
    expect(r.success).toBe(false)
    expect(world.db.rows('payroll_runs')).toHaveLength(0)
  })
  it('no salary set: no ₹0 slip, the admin is told who is missing', async () => {
    resetWorld({ profiles: [{ id: 'p', full_name: 'Asha', role: 'telecaller', is_active: true, base_salary: 0 }], payroll_runs: [], payroll_slips: [] }, {}, 'admin', 'adm')
    const r: any = await createPayrollRun(fd({ year: '2026', month: '10' }))
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/base salary.*Asha/)
    expect(world.db.rows('payroll_slips')).toHaveLength(0)
    expect(world.db.rows('payroll_runs')).toHaveLength(0)
  })
  it('pays a leaver for the days worked and prorates a joiner', async () => {
    resetWorld({ profiles: [
      { id: 'left', full_name: 'L', role: 'telecaller', is_active: false, base_salary: 27000, termination_date: '2026-10-15' },
      { id: 'new', full_name: 'N', role: 'telecaller', is_active: true, base_salary: 27000, joining_date: '2026-10-19' },
      { id: 'later', full_name: 'X', role: 'telecaller', is_active: true, base_salary: 27000, joining_date: '2026-11-02' },
    ], payroll_runs: [], payroll_slips: [] }, {}, 'admin', 'adm')
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    const slips = world.db.rows('payroll_slips')
    expect(slips.map((s) => s.user_id).sort()).toEqual(['left', 'new'])
    // Oct 1–15 has 13 working days; Oct 19–31 has 12.
    expect(slips.find((s) => s.user_id === 'left')).toMatchObject({ present_days: 13, gross: 13000 })
    expect(slips.find((s) => s.user_id === 'new')).toMatchObject({ present_days: 12, gross: 12000 })
  })
  it('days marked absent are loss of pay', async () => {
    resetWorld({ profiles: [{ id: 'p', full_name: 'P', role: 'telecaller', is_active: true, base_salary: 27000 }], payroll_runs: [], payroll_slips: [],
      attendance_logs: [{ user_id: 'p', date: '2026-10-05', status: 'absent' }, { user_id: 'p', date: '2026-10-04', status: 'absent' }] }, {}, 'admin', 'adm')
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    // Oct 4 is a Sunday: only Oct 5 counts.
    expect(world.db.rows('payroll_slips')[0]).toMatchObject({ present_days: 26, lop_days: 1, gross: 26000 })
  })
  it('loss-of-pay deducts per absent day and incentives add on top', async () => {
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    const slip = world.db.rows('payroll_slips').find((s) => s.user_id === 'p1')!
    await updatePayrollSlip(slip.id, fd({ present_days: '24', working_days: '26', incentives: '5000' }))
    const after = world.db.rows('payroll_slips').find((s) => s.user_id === 'p1')!
    expect(after).toMatchObject({ lop_days: 2, present_days: 24 })
    expect(after.net_pay).toBe(Math.round(40000 * 24 / 26) + 5000 - 2000) // earned + incentives − (PF 1800 + PT 200)
  })
  it('only an admin finalises, recording who and when', async () => {
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    const id = world.db.rows('payroll_runs')[0].id
    resetWorld({ payroll_runs: [{ id }] }, {}, 'manager', 'mgr')
    expect(((await finalizePayrollRun(id)) as any).success).toBe(false)
    resetWorld({ payroll_runs: [{ id }] }, {}, 'admin', 'adm')
    await finalizePayrollRun(id)
    expect(world.db.rows('payroll_runs')[0]).toMatchObject({ status: 'completed', processed_by: 'adm' })
  })
})

describe('team admin', () => {
  it('deactivating records the date and reason', async () => {
    resetWorld({ profiles: [{ id: 'e', is_active: true }] }, {}, 'manager')
    await deactivateEmployee('e', 'resigned')
    expect(world.db.rows('profiles')[0]).toMatchObject({ is_active: false, termination_reason: 'resigned' })
    expect(world.db.rows('profiles')[0].termination_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('an admin cannot be locked out by deactivating themselves through the toggle', async () => {
    resetWorld({ profiles: [{ id: 'adm', role: 'admin', is_active: true }] }, {}, 'admin', 'adm')
    const r: any = await toggleMemberActive('adm', false)
    expect(r.success).toBe(false)
    expect(world.db.rows('profiles')[0].is_active).toBe(true)
  })
  it('monthly targets are manager-set and stored per member', async () => {
    resetWorld({ profiles: [{ id: 'e' }], team_targets: [] }, {}, 'manager', 'mgr')
    const r: any = await setMonthlyTarget(fd({ user_id: 'e', month: '10', year: '2026', target_bookings: '3', target_revenue: '5000000' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('team_targets')[0]).toMatchObject({ user_id: 'e', month: 10, year: 2026, target_bookings: 3 })
    // Nobody sets their own target.
    expect(((await setMonthlyTarget(fd({ user_id: 'mgr', month: '10', year: '2026' }))) as any).success).toBe(false)
  })
})
