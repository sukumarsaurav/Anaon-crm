import { world, resetWorld } from '../helpers/db'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const delivered: any[] = []
let deliverResult: any = { success: true, channel: 'whatsapp' }
vi.mock('@/lib/messaging/otp', () => ({ deliverOtp: async (phone: string, otp: string) => { delivered.push({ phone, otp }); return deliverResult } }))
const pushed: any = { expo: [], web: [] }
vi.mock('@/lib/notifications/push', () => ({
  sendExpoPush: async (tokens: string[]) => { pushed.expo.push(tokens); return tokens.filter((t) => t === 'dead-expo') },
  sendWebPush: async (sub: any) => { pushed.web.push(sub); return { dead: sub?.endpoint === 'dead-web' } },
}))
const fired: any[] = []
vi.mock('@/lib/automation/engine', () => ({ fireAutomations: (t: string, c: any, rt?: string, rid?: string) => { fired.push({ t, c, rt, rid }); return Promise.resolve() } }))

let portalSession: any = null
vi.mock('@/lib/portal/session', () => ({ getPortalSession: async () => portalSession }))

const { sendPortalOtp, verifyPortalOtp, requestPaymentExtension, raisePortalComplaint } = await import('@/lib/portal/actions')
const { notifyUsers } = await import('@/lib/notifications/notify')
const { updateMilestoneProgress } = await import('@/lib/construction/actions')

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const rpcLog: any[] = []

describe('client portal login', () => {
  beforeEach(() => {
    delivered.length = 0; rpcLog.length = 0; deliverResult = { success: true, channel: 'whatsapp' }
    resetWorld({}, { rpc: {
      portal_create_otp: (a: any) => { rpcLog.push(['create', a]); return a.p_phone === '9000000000' ? 'no_client' : a.p_phone === '9111111111' ? 'rate_limited' : 'ok' },
      portal_verify_otp: (a: any) => { rpcLog.push(['verify', a]); return a.p_otp_hash.length === 64 ? 'invalid_otp' : 'otp_not_found' },
    } }, null)
  })

  it('normalises any phone format to the last 10 digits before looking the client up', async () => {
    for (const p of ['+91-98100 01025', '919810001025', '09810001025', '9810001025']) {
      rpcLog.length = 0
      await sendPortalOtp(p)
      expect(rpcLog[0][1].p_phone).toBe('9810001025')
    }
  })
  it('sends a 6-digit code over the OTP rail, stores only its HASH, and never returns it', async () => {
    const r = await sendPortalOtp('9810001025')
    expect(r).toEqual({ success: true })
    expect(delivered[0].otp).toMatch(/^\d{6}$/)
    expect(rpcLog[0][1].p_otp_hash).not.toContain(delivered[0].otp)
    expect(rpcLog[0][1].p_otp_hash).toHaveLength(64)
    expect(JSON.stringify(r)).not.toContain(delivered[0].otp)
  })
  it('codes are unpredictable (not the same twice)', async () => {
    await sendPortalOtp('9810001025'); await sendPortalOtp('9810001025')
    expect(delivered[0].otp).not.toBe(delivered[1].otp)
  })
  it('unknown number, rate limit and delivery failure are reported', async () => {
    expect((await sendPortalOtp('9000000000')).error).toMatch(/No account found/)
    expect((await sendPortalOtp('9111111111')).error).toMatch(/Too many/)
    deliverResult = { success: false }
    expect((await sendPortalOtp('9810001025')).error).toMatch(/Could not send/)
  })
  it('verify hashes the code and maps database results to messages', async () => {
    const r = await verifyPortalOtp('+91 98100-01025', '123456')
    expect(rpcLog[0][1].p_phone).toBe('9810001025')
    expect(rpcLog[0][1].p_otp_hash).not.toBe('123456')
    expect(r.success).toBe(false)
  })
})

describe('portal requests by a signed-in customer', () => {
  beforeEach(() => {
    portalSession = { client: { id: 'C1', full_name: 'Sita', phone: '9810001025' } }
    fired.length = 0
    resetWorld({ payments: [{ id: 'P1', client_id: 'C1' }, { id: 'P2', client_id: 'OTHER' }], bookings: [{ id: 'B1', client_id: 'C1' }, { id: 'B2', client_id: 'OTHER' }], profiles: [{ id: 'adm', role: 'admin', is_active: true }, { id: 'adv', role: 'sales_advisor', is_active: true }, { id: 'off', role: 'manager', is_active: false }], notifications: [], push_tokens: [] },
      { rpc: { portal_create_extension_request: () => null, portal_create_complaint: () => null } }, null)
  })
  it('requires a portal session', async () => {
    portalSession = null
    expect((await requestPaymentExtension('x', fd({ payment_id: 'P1' }))).success).toBe(false)
    expect((await raisePortalComplaint('x', fd({}))).success).toBe(false)
  })
  it("a customer cannot ask for an extension on someone else's installment", async () => {
    expect((await requestPaymentExtension('ignored', fd({ payment_id: 'P2', booking_id: 'B1', reason: 'r', requested_date: '2030-01-01' }))).error).toBe('Payment not found')
  })
  it('a valid request notifies active admins/managers only', async () => {
    const r = await requestPaymentExtension('ignored', fd({ payment_id: 'P1', booking_id: 'B1', reason: 'r', requested_date: '2030-01-01' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('notifications').map((n) => n.user_id)).toEqual(['adm'])
    expect(world.db.rows('notifications')[0]).toMatchObject({ type: 'extension_request', action_url: '/clients/extension-requests' })
  })
  it("a complaint cannot reference someone else's booking, and a valid one notifies staff and fires the automation", async () => {
    expect((await raisePortalComplaint('x', fd({ booking_id: 'B2', category: 'c', title: 't', description: 'd' }))).error).toBe('Booking not found')
    const r = await raisePortalComplaint('x', fd({ booking_id: 'B1', category: 'construction', title: 'Delay', description: 'late' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('notifications')).toHaveLength(1)
    expect(fired[0].t).toBe('complaint_raised')
  })
  it('the client id argument is ignored (a server action is a public endpoint)', async () => {
    portalSession = { client: { id: 'C1', full_name: 'Sita', phone: '1' } }
    await requestPaymentExtension('OTHER', fd({ payment_id: 'P1', booking_id: 'B1', reason: 'r', requested_date: '2030-01-01' }))
    expect(world.db.rows('notifications')[0].related_record_id ?? world.db.rows('notifications')[0].related_id).toBe('C1')
  })
})

describe('notifyUsers', () => {
  beforeEach(() => { pushed.expo.length = 0; pushed.web.length = 0; resetWorld({ notifications: [], push_tokens: [
    { user_id: 'u1', platform: 'expo', expo_token: 'good-expo', endpoint: 'good-expo' },
    { user_id: 'u1', platform: 'expo', expo_token: 'dead-expo', endpoint: 'dead-expo' },
    { user_id: 'u1', platform: 'web', web_subscription: { endpoint: 'good-web' }, endpoint: 'good-web' },
    { user_id: 'u1', platform: 'web', web_subscription: { endpoint: 'dead-web' }, endpoint: 'dead-web' },
    { user_id: 'u2', platform: 'expo', expo_token: 'other-user', endpoint: 'other-user' },
  ] }, {}, null) })

  it('one in-app row per distinct user (blank ids and duplicates dropped)', async () => {
    await notifyUsers(['u1', 'u1', '', 'u3'], { title: 'T', message: 'M', type: 'x', related_type: 'lead', related_id: 'L', action_url: '/leads/L' })
    expect(world.db.rows('notifications').map((n) => n.user_id).sort()).toEqual(['u1', 'u3'])
    expect(world.db.rows('notifications')[0]).toMatchObject({ title: 'T', body: 'M', type: 'x', related_record_type: 'lead', action_url: '/leads/L' })
  })
  it('pushes only to the recipients’ devices and removes dead endpoints', async () => {
    await notifyUsers(['u1'], { title: 'T', message: 'M' })
    expect(pushed.expo[0].sort()).toEqual(['dead-expo', 'good-expo'])
    expect(world.db.rows('push_tokens').map((t) => t.endpoint).sort()).toEqual(['good-expo', 'good-web', 'other-user'])
  })
  it('nobody to notify is a no-op; a database failure never throws', async () => {
    await expect(notifyUsers([], { title: 'T', message: 'M' })).resolves.toBeUndefined()
    ;(world.db as any).from = () => { throw new Error('down') }
    await expect(notifyUsers(['u1'], { title: 'T', message: 'M' })).resolves.toBeUndefined()
  })
  it('a rejected insert is logged, not silently lost', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    resetWorld({ notifications: [] }, { beforeWrite: (t) => (t === 'notifications' ? { message: 'invalid input syntax for type uuid' } : null) }, null)
    await notifyUsers(['u1'], { title: 'T', message: 'M' })
    expect(err).toHaveBeenCalledWith('[notify] insert failed:', expect.stringContaining('uuid'))
  })
})

describe('construction milestones', () => {
  beforeEach(() => {
    fired.length = 0
    resetWorld({
      construction_milestones: [{ id: 'M1', name: 'Foundation', status: 'in_progress', project_id: 'PR', photos: [] }],
      projects: [{ id: 'PR', name: 'ANON Greens' }],
      bookings: [
        { id: 'B1', project_id: 'PR', status: 'confirmed', client: { id: 'C1', full_name: 'Sita', phone: '9810001025' } },
        { id: 'B2', project_id: 'PR', status: 'confirmed', client: { id: 'C2', full_name: 'Ram', phone: '9810001026' } },
        { id: 'B3', project_id: 'PR', status: 'cancelled', client: { id: 'C3', full_name: 'Gone', phone: '1' } },
        { id: 'B4', project_id: 'OTHER', status: 'confirmed', client: { id: 'C4', full_name: 'Other', phone: '2' } },
      ],
    }, {}, 'sales_advisor', 'adv')
  })
  it('completing a milestone notifies each confirmed client of THAT project, with the project name', async () => {
    const r: any = await updateMilestoneProgress('M1', 'PR', fd({ completion_percentage: '100', status: 'completed', completion_date: '2026-10-20' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('construction_milestones')[0]).toMatchObject({ status: 'completed', completion_percentage: 100, actual_completion_date: '2026-10-20', completed_by: 'adv' })
    expect(fired.map((f) => f.c.client.id).sort()).toEqual(['C1', 'C2'])
    expect(fired[0].c.project.name).toBe('ANON Greens')
    expect(fired.every((f) => f.t === 'milestone_completed')).toBe(true)
  })
  it('re-saving an already-completed milestone does not message everyone again', async () => {
    world.db.rows('construction_milestones')[0].status = 'completed'
    await updateMilestoneProgress('M1', 'PR', fd({ completion_percentage: '100', status: 'completed' }))
    expect(fired).toHaveLength(0)
  })
  it('progress updates (not completed) send nothing; photos accumulate', async () => {
    await updateMilestoneProgress('M1', 'PR', fd({ completion_percentage: '40', status: 'in_progress' }))
    expect(fired).toHaveLength(0)
    const f = new FormData(); f.set('completion_percentage', '60'); f.set('status', 'in_progress'); f.append('photos', 'a.jpg'); f.append('photos', 'b.jpg')
    await updateMilestoneProgress('M1', 'PR', f)
    expect(world.db.rows('construction_milestones')[0].photos).toEqual(['a.jpg', 'b.jpg'])
  })
  it('a telecaller cannot update milestones', async () => {
    resetWorld({ construction_milestones: [{ id: 'M1' }] }, {}, 'telecaller')
    expect(((await updateMilestoneProgress('M1', 'PR', fd({ status: 'completed', completion_percentage: '100' }))) as any).success).toBe(false)
  })
})
