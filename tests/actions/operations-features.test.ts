import { world, resetWorld } from '../helpers/world'
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { passwordProblem, MUST_CHANGE_PASSWORD } from '@/lib/security/passwordPolicy'
import { resetStaffPassword } from '@/lib/team/staff'
import { addJunior } from '@/lib/team/teams'
import { convertCandidateToEmployee, createPayrollRun } from '@/lib/hr/actions'
import { slabProblem, type SlabDraft } from '@/lib/team/commission'
import { saveIncentiveSlabs } from '@/lib/team/incentives'
import { dueAlerts } from '@/lib/legal/alerts'
import { receiveApplication, resumeUploadSlot } from '@/lib/hr/careersIntake'

/** Phases A–G of docs/OPERATIONS_FEATURES_PLAN_2026-10-21.md. */

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const teams = [{ id: 'T1', name: 'Sales', leader_id: 'adm', parent_team_id: null, is_active: true, branch_id: null }]

describe('A · forced password change', () => {
  it('password rules', () => {
    expect(passwordProblem('short1')).toMatch(/at least 10/)
    expect(passwordProblem('onlyletterspassword')).toMatch(/letters and numbers/)
    expect(passwordProblem('Anon-1a2b3c4d@2026')).toMatch(/temporary/)
    expect(passwordProblem('ravi.kumar2026', { email: 'ravi.kumar@x.in' })).toMatch(/email/)
    expect(passwordProblem('Sunrise-Plots-77')).toBeNull()
  })
  it('new accounts from Add junior must change their password', async () => {
    resetWorld({ teams, profiles: [{ id: 'adm', role: 'admin', is_active: true, team_id: null }] }, {}, 'admin', 'adm')
    const r = await addJunior({ full_name: 'New Person', email: 'new@x.in', role: 'telecaller', target_team_id: 'T1', mode: 'member' })
    expect(r.success).toBe(true)
    expect(world.db.users.find((u) => u.email === 'new@x.in')?.app_metadata?.[MUST_CHANGE_PASSWORD]).toBe(true)
  })
  it('admin reset: new temporary password, flag set; never for yourself or by a manager', async () => {
    resetWorld({ profiles: [{ id: 'e', role: 'sales_advisor', full_name: 'E', is_active: true }], user_sessions: [] }, {}, 'admin', 'adm')
    world.db.users = [{ id: 'e', email: 'e@x.in', app_metadata: { role: 'sales_advisor' } }]
    const r = await resetStaffPassword('e')
    expect(r.success).toBe(true)
    expect(world.db.users[0]).toMatchObject({ password: r.tempPassword, app_metadata: { role: 'sales_advisor', [MUST_CHANGE_PASSWORD]: true } })
    resetWorld({ profiles: [{ id: 'e', role: 'sales_advisor', is_active: true }] }, {}, 'manager', 'mgr')
    expect((await resetStaffPassword('e')).success).toBe(false)
  })
})

describe('B · candidate joins → CRM login', () => {
  const seed = () => resetWorld({
    teams,
    profiles: [{ id: 'adm', role: 'admin', is_active: true }],
    career_applications: [{ id: 'C1', name: 'Riya Shah', phone: '9810001000', email: 'riya@x.in', stage: 'offer', offer_ctc: 600000, profile_id: null }],
  }, {}, 'admin', 'adm')

  it('creates the login and HR record, and links the candidate', async () => {
    seed()
    const r: any = await convertCandidateToEmployee('C1', fd({ role: 'sales_advisor', team_id: 'T1', joining_date: '2026-11-02', base_salary: '50000' }))
    expect(r.success).toBe(true)
    expect(r.tempPassword).toMatch(/^Anon-/)
    const p = world.db.rows('profiles').find((x) => x.id === r.employeeId)!
    expect(p).toMatchObject({ full_name: 'Riya Shah', email: 'riya@x.in', role: 'sales_advisor', team_id: 'T1', joining_date: '2026-11-02', base_salary: 50000, employee_id: 'EMP-0001' })
    expect(world.db.rows('career_applications')[0]).toMatchObject({ stage: 'joined', profile_id: r.employeeId })
  })
  it('only once, and never a role above your own', async () => {
    seed()
    await convertCandidateToEmployee('C1', fd({ role: 'telecaller', team_id: 'T1' }))
    expect(((await convertCandidateToEmployee('C1', fd({ role: 'telecaller', team_id: 'T1' }))) as any).error).toMatch(/already has a CRM login/)
    resetWorld({ teams: [{ ...teams[0], leader_id: 'mgr' }], profiles: [{ id: 'mgr', role: 'manager', is_active: true }],
      career_applications: [{ id: 'C2', name: 'X', phone: '9', email: 'x@x.in', stage: 'offer' }] }, {}, 'manager', 'mgr')
    // A manager can't create an admin (not offered) — and the rank rule refuses anything unknown.
    expect(((await convertCandidateToEmployee('C2', fd({ role: 'admin', team_id: 'T1' }))) as any).success).toBe(false)
  })
})

describe('D · incentive slabs', () => {
  const ok: SlabDraft[] = [
    { label: 'Base', from_bookings: 0, to_bookings: 2, commission_percent: 0, bonus_amount: 0, is_active: true },
    { label: 'Silver', from_bookings: 3, to_bookings: 5, commission_percent: 1, bonus_amount: 0, is_active: true },
    { label: 'Gold', from_bookings: 6, to_bookings: null, commission_percent: 1.5, bonus_amount: 25000, is_active: true },
  ]
  it('the active slabs must cover every booking count once', () => {
    expect(slabProblem(ok)).toBeNull()
    expect(slabProblem([{ ...ok[0], from_bookings: 1 }, ...ok.slice(1)])).toMatch(/start at 0/)
    expect(slabProblem([ok[0], { ...ok[1], from_bookings: 4 }, ok[2]])).toMatch(/Gap/)
    expect(slabProblem([ok[0], { ...ok[1], from_bookings: 2 }, ok[2]])).toMatch(/overlap/)
    expect(slabProblem([ok[0], ok[1], { ...ok[2], to_bookings: 9 }])).toMatch(/open-ended/)
    expect(slabProblem([ok[0], { ...ok[1], commission_percent: 25 }, ok[2]])).toMatch(/0–10%/)
    // An inactive slab doesn't count.
    expect(slabProblem([...ok, { label: 'Old', from_bookings: 4, to_bookings: 4, commission_percent: 1, bonus_amount: 0, is_active: false }])).toBeNull()
  })
  it('only an admin saves, and the whole table is replaced', async () => {
    resetWorld({ incentive_slabs: [{ id: 's-old', label: 'Old', from_bookings: 0, to_bookings: null }] }, {}, 'manager')
    expect((await saveIncentiveSlabs(ok)).success).toBe(false)
    resetWorld({ incentive_slabs: [{ id: 's-old', label: 'Old', from_bookings: 0, to_bookings: null }] }, {}, 'admin')
    expect((await saveIncentiveSlabs(ok)).success).toBe(true)
    expect(world.db.rows('incentive_slabs').map((s) => s.label)).toEqual(['Base', 'Silver', 'Gold'])
  })
  it('payroll pre-fills each seller\'s incentive from confirmed bookings and the slabs', async () => {
    resetWorld({
      profiles: [{ id: 'a', full_name: 'A', role: 'sales_advisor', is_active: true, base_salary: 27000 }],
      bookings: [
        ...[1, 2, 3].map((i) => ({ id: `b${i}`, advisor_id: 'a', status: 'confirmed', total_sale_value: 2_000_000, booking_date: `2026-10-0${i + 1}` })),
        { id: 'bx', advisor_id: 'a', status: 'cancelled', total_sale_value: 9_000_000, booking_date: '2026-10-09' },
      ],
      incentive_slabs: ok.map((s, i) => ({ ...s, id: `s${i}`, sort_order: i + 1 })),
      payroll_runs: [], payroll_slips: [], leave_requests: [], attendance_logs: [],
    }, {}, 'admin', 'adm')
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    // 3 bookings → Silver: 1% of ₹60L = ₹60,000.
    expect(world.db.rows('payroll_slips')[0]).toMatchObject({ incentives: 60000, gross: 27000 + 60000 })
  })
})

describe('E · compliance alerts', () => {
  const p = (o: Record<string, string | null>) => ({ id: 'P', name: 'Anon Heights', rera_expiry_date: null, quarterly_report_due_date: null, ...o })
  it('expiry: on each threshold day, the day itself, then weekly', () => {
    expect(dueAlerts([p({ rera_expiry_date: '2026-11-20' })], new Map(), '2026-10-21')[0]).toMatchObject({ kind: 'rera_expiry', threshold: '2026-11-20:30', severity: 'critical' })
    expect(dueAlerts([p({ rera_expiry_date: '2026-11-21' })], new Map(), '2026-10-21')).toEqual([])
    expect(dueAlerts([p({ rera_expiry_date: '2026-10-21' })], new Map(), '2026-10-21')[0].title).toMatch(/expired/)
    expect(dueAlerts([p({ rera_expiry_date: '2026-10-14' })], new Map(), '2026-10-21')[0].threshold).toBe('2026-10-14:-7')
    expect(dueAlerts([p({ rera_expiry_date: '2026-10-15' })], new Map(), '2026-10-21')).toEqual([])
  })
  it('quarterly report: before, on and overdue', () => {
    expect(dueAlerts([p({ quarterly_report_due_date: '2026-10-24' })], new Map(), '2026-10-21')[0]).toMatchObject({ kind: 'quarterly_report', threshold: '2026-10-24:3' })
    expect(dueAlerts([p({ quarterly_report_due_date: '2026-10-07' })], new Map(), '2026-10-21')[0].title).toMatch(/overdue/)
  })
  it('missing documents only on Mondays', () => {
    const docs = new Map([['P', new Set(['rera_certificate', 'title_deed'])]])
    expect(dueAlerts([p({})], docs, '2026-10-19')[0]).toMatchObject({ kind: 'missing_documents', threshold: '2026-10-19' }) // Monday
    expect(dueAlerts([p({})], docs, '2026-10-21')).toEqual([])
    expect(dueAlerts([p({})], docs, '2026-10-19')[0].message).toMatch(/Layout approval, Fire NOC/)
  })
})

describe('G · careers intake', () => {
  it('validates, ignores bots, de-duplicates and keeps the title of an unknown listing', async () => {
    resetWorld({ career_applications: [], career_listings: [{ id: '11111111-1111-1111-1111-111111111111', title: 'Sales Executive' }], profiles: [] })
    expect(await receiveApplication({ name: 'R', phone: '123' })).toMatchObject({ ok: false, status: 400 })
    expect(await receiveApplication({ name: 'Bot', phone: '9810001000', company_website: 'spam.example' })).toEqual({ ok: true })
    expect(world.db.rows('career_applications')).toHaveLength(0)

    expect((await receiveApplication({ name: 'Riya', phone: '+91 98100 01000', listing_id: '11111111-1111-1111-1111-111111111111' })).ok).toBe(true)
    expect((await receiveApplication({ name: 'Riya', phone: '9810001000', listing_id: '11111111-1111-1111-1111-111111111111' }))).toEqual({ ok: true, duplicate: true })
    await receiveApplication({ name: 'Riya', phone: '9810001000', listing_id: '22222222-2222-2222-2222-222222222222', listing_title: 'Telecaller' })
    const rows = world.db.rows('career_applications')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ phone: '9810001000', listing_id: '11111111-1111-1111-1111-111111111111', source: 'website', stage: 'applied' })
    expect(rows[1]).toMatchObject({ listing_id: null, cover_letter: 'Applied for: Telecaller' })
  })
  it('a CV must come from our upload slot and needs consent', async () => {
    resetWorld({ career_applications: [], profiles: [] })
    expect((await receiveApplication({ name: 'R', phone: '9810001000', resume_url: 'https://evil.example/cv.pdf', cv_consent: true })).ok).toBe(false)
    expect((await receiveApplication({ name: 'R', phone: '9810001000', resume_url: '/api/files/hr/applications/2026-10/x.pdf' })).ok).toBe(false)
    const r = await receiveApplication({ name: 'R', phone: '9810001000', resume_url: '/api/files/hr/applications/2026-10/x.pdf', cv_consent: true })
    expect(r.ok).toBe(true)
    expect(world.db.rows('career_applications')[0].cv_consent_at).toBeTruthy()
  })
  it('upload slot: PDF / Word up to 5 MB, in the applications folder', async () => {
    resetWorld({})
    expect((await resumeUploadSlot({ filename: 'a.exe', contentType: 'application/x-msdownload', size: 10 })).ok).toBe(false)
    expect((await resumeUploadSlot({ filename: 'a.pdf', contentType: 'application/pdf', size: 6 * 1024 * 1024 })).ok).toBe(false)
    const r = await resumeUploadSlot({ filename: 'My CV.pdf', contentType: 'application/pdf', size: 1000 })
    expect(r).toMatchObject({ ok: true })
    if (r.ok) expect(r.fileUrl).toMatch(/^\/api\/files\/hr\/applications\/\d{4}-\d{2}\/.+My_CV\.pdf$/)
  })
  it('the webhook needs the shared secret', async () => {
    resetWorld({ career_applications: [], profiles: [] })
    const { POST } = await import('@/app/api/webhooks/careers/route')
    const call = (secret?: string) => POST(new NextRequest('http://localhost/api/webhooks/careers', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-webhook-secret': secret } : {}) },
      body: JSON.stringify({ name: 'Riya', phone: '9810001000' }),
    }))
    expect((await call()).status).toBe(401)
    expect((await call('wrong')).status).toBe(401)
    expect((await call('careers-secret')).status).toBe(200)
    expect(world.db.rows('career_applications')).toHaveLength(1)
  })
})
