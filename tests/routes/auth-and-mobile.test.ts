import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Modules create their client once at import time, so hand out a proxy that always follows the CURRENT fake db.
vi.mock('@supabase/supabase-js', () => ({ createClient: () => new Proxy({}, { get: (_t, k) => { const v = (world.db as any)[k]; return typeof v === 'function' ? v.bind(world.db) : v } }) }))

const req = (url: string, init: { method?: string; headers?: Record<string, string>; body?: any } = {}) =>
  new NextRequest(`http://localhost${url}`, { method: init.method ?? 'POST', headers: init.headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
const json = async (r: Response) => ({ status: r.status, body: await r.json().catch(() => null) })

describe('login route', async () => {
  const { POST } = await import('@/app/api/auth/login/route')
  const profile = (o: any = {}) => ({ id: 'u1', email: 'staff@x.in', role: 'sales_advisor', is_active: true, failed_login_count: 0, lockout_until: null, last_failed_login_at: null, ...o })
  const login = (email: string, password: string) => POST(req('/api/auth/login', { body: { email, password }, headers: { 'x-forwarded-for': '1.2.3.4' } }))
  const setup = (p: any = {}, extra: any = {}) => {
    const db = resetWorld({ profiles: [profile(p)], security_settings: [{ max_failed_attempts: 3, lockout_minutes: 30 }], user_sessions: [], audit_logs: [], ...extra }, { rpc: { write_audit_log: () => null } }, null)
    db.auth.credentials['staff@x.in'] = { password: 'right', id: 'u1' }
    return db
  }

  it('validates input', async () => {
    setup()
    expect((await json(await POST(req('/api/auth/login', { body: { email: 'a' } })))).status).toBe(400)
  })
  it('success: sends staff to the dashboard and resets the failure counter', async () => {
    setup({ failed_login_count: 2, last_failed_login_at: new Date().toISOString() })
    const r = await json(await login('staff@x.in', 'right'))
    expect(r).toMatchObject({ status: 200, body: { redirectTo: '/dashboard' } })
    expect(world.db.rows('profiles')[0]).toMatchObject({ failed_login_count: 0, lockout_until: null })
    expect(world.db.rows('user_sessions')).toHaveLength(1)
  })
  it('brokers land in the broker portal', async () => {
    setup({ role: 'broker' })
    expect((await json(await login('staff@x.in', 'right'))).body.redirectTo).toBe('/broker-portal')
  })
  it('a deactivated account cannot sign in, and is signed back out', async () => {
    setup({ is_active: false })
    const r = await json(await login('staff@x.in', 'right'))
    expect(r.status).toBe(403)
    expect(r.body.error).toMatch(/deactivated/)
    expect(world.db.signedOut).toBe(true)
  })
  it('an account with no CRM role is turned away', async () => {
    setup({ role: null })
    expect((await json(await login('staff@x.in', 'right'))).status).toBe(403)
  })
  it('wrong password and unknown email give the SAME message (no user enumeration)', async () => {
    setup()
    const a = await json(await login('staff@x.in', 'wrong'))
    const b = await json(await login('nobody@x.in', 'wrong'))
    expect(a.status).toBe(401); expect(b.status).toBe(401)
    expect(a.body.error).toBe(b.body.error)
  })
  it('locks after the configured number of failures, and a correct password is refused while locked', async () => {
    setup()
    await login('staff@x.in', 'bad'); await login('staff@x.in', 'bad')
    const third = await json(await login('staff@x.in', 'bad'))
    expect(third.status).toBe(423)
    const locked = await json(await login('staff@x.in', 'right'))
    expect(locked.status).toBe(423)
    expect(locked.body.error).toMatch(/Account locked/)
  })
  it('old failures stop counting after the lockout window', async () => {
    setup({ failed_login_count: 2, last_failed_login_at: new Date(Date.now() - 31 * 60_000).toISOString() })
    expect((await json(await login('staff@x.in', 'bad'))).status).toBe(401) // count restarts at 1, not 3
    expect(world.db.rows('profiles')[0].failed_login_count).toBe(1)
  })
  it('an expired lockout lets the user back in', async () => {
    setup({ lockout_until: new Date(Date.now() - 1000).toISOString() })
    expect((await json(await login('staff@x.in', 'right'))).status).toBe(200)
  })
  it('emails are matched literally: "_" is not a wildcard', async () => {
    setup({ email: 'axb@x.in' }, {})
    world.db.auth.credentials['a_b@x.in'] = { password: 'p', id: 'nobody' }
    // Someone failing to log in as a_b@x.in must not count against axb@x.in
    await login('a_b@x.in', 'wrong')
    expect(world.db.rows('profiles')[0].failed_login_count).toBe(0)
  })
})

describe('mobile API', async () => {
  const leads = await import('@/app/api/mobile/leads/route')
  const attendance = await import('@/app/api/mobile/attendance/route')
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` })
  beforeEach(() => {
    const db = resetWorld({
      profiles: [{ id: 'u1', role: 'sales_advisor', is_active: true }, { id: 'brk', role: 'broker', is_active: true }, { id: 'off', role: 'sales_advisor', is_active: false }],
      leads: [{ id: 'L1', full_name: 'Mine', phone: '1', assigned_to: 'u1', is_active: true, stage: 'new_lead' }, { id: 'L2', full_name: 'Theirs', phone: '2', assigned_to: 'u2', is_active: true, stage: 'new_lead' }],
      attendance: [],
    }, {}, null)
    db.auth.tokens = { good: { id: 'u1', email: 'a@x' }, brk: { id: 'brk', email: 'b@x' }, off: { id: 'off', email: 'o@x' } }
  })
  it('rejects missing, bad, inactive and broker tokens', async () => {
    expect((await leads.GET(req('/api/mobile/leads', { method: 'GET' }))).status).toBe(401)
    for (const t of ['bad', 'off', 'brk']) expect((await leads.GET(req('/api/mobile/leads', { method: 'GET', headers: bearer(t) }))).status).toBe(401)
  })
  it('lists the caller’s own leads by default', async () => {
    const r = await json(await leads.GET(req('/api/mobile/leads', { method: 'GET', headers: bearer('good') })))
    expect(r.status).toBe(200)
    expect(r.body.map((l: any) => l.id)).toEqual(['L1'])
  })
  it('check-in then check-out; a second check-in while one is open is refused', async () => {
    const post = (b: any) => attendance.POST(req('/api/mobile/attendance', { headers: bearer('good'), body: b }))
    expect((await json(await post({ action: 'check_in', lat: 1, lng: 2 }))).body.success).toBe(true)
    expect((await json(await post({ action: 'check_in', lat: 1, lng: 2 }))).status).toBe(409)
    expect(world.db.rows('attendance')).toHaveLength(1)
    expect((await json(await post({ action: 'check_out', lat: 1, lng: 2 }))).body.success).toBe(true)
    expect(world.db.rows('attendance')[0].check_out_time).toBeTruthy()
    expect((await json(await post({ action: 'check_out' }))).status).toBe(404)
    expect((await json(await post({ action: 'dance' }))).status).toBe(400)
  })
  it('an open check-in from just after IST midnight still counts as today (UTC date would be yesterday)', async () => {
    // 00:30 IST today == 19:00 UTC yesterday
    const istNow = new Date(Date.now() + 330 * 60000)
    const istMidnightUtc = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - 330 * 60000
    world.db.rows('attendance').push({ id: 'x', user_id: 'u1', check_in_time: new Date(istMidnightUtc + 30 * 60000).toISOString(), check_out_time: null })
    const r = await attendance.POST(req('/api/mobile/attendance', { headers: bearer('good'), body: { action: 'check_in' } }))
    expect(r.status).toBe(409)
  })
})
