import { world, resetWorld } from '../helpers/db'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const calls: any[] = []
let nextResult: (i: number) => any = () => ({ success: true, messageId: 'wamid.X', to: '919810001025' })
vi.mock('@/lib/whatsapp/send', () => ({
  sendWhatsAppTemplate: async (a: any) => { calls.push(a); return nextResult(calls.length) },
  recordOutboundWhatsApp: async () => {},
  isMarketingCategory: (c?: string | null) => { const x = (c ?? '').toLowerCase(); return x !== 'utility' && x !== 'authentication' },
}))

const { queueBroadcast, processBroadcast, applyBroadcastReceipt, markBroadcastReplied, recomputeBroadcastTotals, requeueFailedRecipients, runDueBroadcasts, sanitizeAudienceFilters } = await import('@/lib/whatsapp/broadcast')

const lead = (id: string, phone: string, o: any = {}) => ({ id, full_name: `Lead ${id}`, phone, is_active: true, stage: 'contacted', source: 'facebook_ads', project: { name: 'Greens' }, advisor: { full_name: 'Priya', phone: '9999999999' }, ...o })
const tpl = (o: any = {}) => ({ id: 't', name: 'diwali', language: 'en', category: 'marketing', status: 'approved', is_active: true, body: 'Hi {{name}}', variable_names: ['name'], ...o })
const seed = (o: any = {}) => ({
  whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'admin1', audience_filters: {}, template: tpl() }],
  profiles: [{ id: 'admin1', role: 'admin', branch_id: null }, { id: 'mgr1', role: 'manager', branch_id: 'br1' }, { id: 'mgr0', role: 'manager', branch_id: null }],
  leads: [lead('L1', '+91-9810001025'), lead('L2', '9810001025'), lead('L3', '9810001026'), lead('L4', '9810001027', { stage: 'interested' })],
  whatsapp_conversations: [], whatsapp_broadcast_recipients: [], ...o,
})

describe('broadcast audience', () => {
  beforeEach(() => { calls.length = 0; resetWorld(seed(), {}, null) })

  it('sends one message per WhatsApp number even if several leads share it', async () => {
    const r = await queueBroadcast('B')
    expect(r).toMatchObject({ success: true, queued: 3 })
    expect(world.db.rows('whatsapp_broadcast_recipients').map((x) => x.phone).sort()).toEqual(['919810001025', '919810001026', '919810001027'])
    expect(world.db.rows('whatsapp_broadcasts')[0]).toMatchObject({ status: 'sending', audience_count: 3 })
  })
  it('stage / source filters narrow the audience', async () => {
    world.db.rows('whatsapp_broadcasts')[0].audience_filters = { stage: ['interested'] }
    expect((await queueBroadcast('B')).queued).toBe(1)
  })
  it('opted-out contacts are skipped for MARKETING templates, not for UTILITY ones', async () => {
    world.db.rows('whatsapp_conversations').push({ wa_id: '919810001026', opted_out: true })
    const r = await queueBroadcast('B')
    expect(r).toMatchObject({ queued: 2, skipped: 1 })
    expect(world.db.rows('whatsapp_broadcast_recipients').find((x) => x.phone === '919810001026')).toMatchObject({ status: 'failed', skipped_opted_out: true })
    resetWorld(seed({ whatsapp_conversations: [{ wa_id: '919810001026', opted_out: true }], whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'admin1', audience_filters: {}, template: tpl({ category: 'utility' }) }] }), {}, null)
    expect((await queueBroadcast('B')).queued).toBe(3)
  })
  it('a lead a template variable cannot be filled for is failed up front, not sent blank', async () => {
    world.db.rows('whatsapp_broadcasts')[0].template = tpl({ variable_names: ['offer code'] })
    const r = await queueBroadcast('B')
    expect(r).toMatchObject({ queued: 0 })
    expect(world.db.rows('whatsapp_broadcast_recipients')[0].failed_reason).toMatch(/No value for/)
    // ...unless the broadcast supplies it
    resetWorld(seed({ whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'admin1', audience_filters: { variables: { 'offer code': 'DIWALI5' } }, template: tpl({ variable_names: ['offer code'] }) }] }), {}, null)
    expect((await queueBroadcast('B')).queued).toBe(3)
  })
  it('refuses an unapproved template, a started broadcast, an empty audience and an unknown id', async () => {
    world.db.rows('whatsapp_broadcasts')[0].template = tpl({ status: 'pending_approval' })
    expect((await queueBroadcast('B')).error).toMatch(/not approved/)
    world.db.rows('whatsapp_broadcasts')[0].template = tpl()
    world.db.rows('whatsapp_broadcasts')[0].status = 'sending'
    expect((await queueBroadcast('B')).error).toMatch(/already been started/)
    expect((await queueBroadcast('nope')).success).toBe(false)
    resetWorld(seed({ leads: [] }), {}, null)
    expect((await queueBroadcast('B')).error).toMatch(/No leads match/)
  })
  it('reach follows the creator: admin everyone, manager their branch only, branchless manager nothing', async () => {
    resetWorld(seed({ leads: [lead('L1', '9810001025', { branch_id: 'br1' }), lead('L2', '9810001026', { branch_id: 'br2' })], whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'mgr1', audience_filters: {}, template: tpl() }] }), {}, null)
    expect((await queueBroadcast('B')).queued).toBe(1)
    resetWorld(seed({ whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'mgr0', audience_filters: {}, template: tpl() }] }), {}, null)
    expect((await queueBroadcast('B')).success).toBe(false)
    resetWorld(seed({ whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'nobody', audience_filters: {}, template: tpl() }] }), {}, null)
    expect((await queueBroadcast('B')).success).toBe(false)
  })
})

describe('broadcast sending', () => {
  beforeEach(async () => { calls.length = 0; nextResult = () => ({ success: true, messageId: 'wamid.X', to: '1' }); resetWorld(seed(), {}, null); await queueBroadcast('B') })

  it('sends every queued recipient with an idempotent reference, marks them sent and completes the broadcast', async () => {
    const r = await processBroadcast('B')
    expect(r).toMatchObject({ sent: 3, failed: 0, remaining: 0, rateLimited: false })
    expect(calls.map((c) => c.reference).every((ref: string) => /^bcast_/.test(ref))).toBe(true)
    expect(new Set(calls.map((c) => c.reference)).size).toBe(3)
    expect(calls[0].variables).toEqual({ name: expect.stringContaining('Lead') })
    expect(world.db.rows('whatsapp_broadcasts')[0]).toMatchObject({ status: 'sent', total_sent: 3, total_failed: 0 })
  })
  it('re-running does not message anyone twice', async () => {
    await processBroadcast('B')
    calls.length = 0
    await processBroadcast('B')
    expect(calls).toHaveLength(0)
  })
  it('a rate limit stops the batch and leaves the rest queued to resume', async () => {
    nextResult = (i) => (i === 2 ? { success: false, rateLimited: true, error: '429' } : { success: true, messageId: 'w' + i, to: '1' })
    const r = await processBroadcast('B')
    expect(r).toMatchObject({ sent: 1, rateLimited: true, remaining: 2 })
    expect(world.db.rows('whatsapp_broadcasts')[0].status).toBe('sending')
    nextResult = () => ({ success: true, messageId: 'z', to: '1' })
    expect((await processBroadcast('B')).remaining).toBe(0)
  })
  it('a failed send is recorded with its reason, and an opt-out AgencyX knew about is flagged', async () => {
    nextResult = (i) => (i === 1 ? { success: false, optedOut: true, error: 'opted_out' } : i === 2 ? { success: false, error: 'invalid number' } : { success: true, messageId: 'ok', to: '1' })
    const r = await processBroadcast('B')
    expect(r).toMatchObject({ sent: 1, failed: 2 })
    const rows = world.db.rows('whatsapp_broadcast_recipients')
    expect(rows.find((x) => x.skipped_opted_out)).toMatchObject({ failed_reason: 'Opted out of WhatsApp' })
    expect(rows.find((x) => x.failed_reason === 'invalid number')).toBeTruthy()
  })
  it('respects the time budget', async () => {
    const r = await processBroadcast('B', 0)
    expect(r.sent).toBe(0)
    expect(r.remaining).toBe(3)
  })
})

describe('delivery receipts and replies', () => {
  beforeEach(async () => { resetWorld(seed(), {}, null); await queueBroadcast('B'); await processBroadcast('B') })
  const wamid = () => world.db.rows('whatsapp_broadcast_recipients')[0].wa_message_id
  it('receipts only move forward: read is never downgraded to delivered, and failed never overrides read', async () => {
    world.db.rows('whatsapp_broadcast_recipients').forEach((r) => { r.wa_message_id = 'w-' + r.id })
    const id = wamid()
    await applyBroadcastReceipt(id, 'read', '2026-10-20T10:00:00Z')
    await applyBroadcastReceipt(id, 'delivered', '2026-10-20T10:01:00Z')
    expect(world.db.rows('whatsapp_broadcast_recipients')[0].status).toBe('read')
    await applyBroadcastReceipt(id, 'failed', '2026-10-20T10:02:00Z', 'x')
    expect(world.db.rows('whatsapp_broadcast_recipients')[0].status).toBe('read')
    expect(world.db.rows('whatsapp_broadcasts')[0]).toMatchObject({ total_read: 1, total_delivered: 1 })
  })
  it('a reply within a week counts, an older send does not', async () => {
    const recent = world.db.rows('whatsapp_broadcast_recipients')[0]
    recent.sent_at = new Date().toISOString()
    world.db.rows('whatsapp_broadcast_recipients')[1].sent_at = new Date(Date.now() - 10 * 86400000).toISOString()
    await markBroadcastReplied(recent.phone)
    expect(world.db.rows('whatsapp_broadcast_recipients')[0].replied).toBe(true)
    await markBroadcastReplied(world.db.rows('whatsapp_broadcast_recipients')[1].phone)
    expect(world.db.rows('whatsapp_broadcast_recipients')[1].replied).toBeFalsy()
    expect(world.db.rows('whatsapp_broadcasts')[0].total_replied).toBe(1)
  })
  it('an unknown message id is ignored', async () => {
    await expect(applyBroadcastReceipt('nope', 'read', '2026-10-20T10:00:00Z')).resolves.toBeUndefined()
  })
  it('totals are recounted from the rows', async () => {
    world.db.rows('whatsapp_broadcasts')[0].total_sent = 999
    await recomputeBroadcastTotals('B')
    expect(world.db.rows('whatsapp_broadcasts')[0].total_sent).toBe(3)
  })
})

describe('audience rules', () => {
  beforeEach(() => { calls.length = 0; resetWorld(seed(), {}, null) })

  it('won and lost leads are left out unless their stage is picked', async () => {
    world.db.rows('leads').push(lead('L5', '9810001028', { stage: 'closed_won' }), lead('L6', '9810001029', { stage: 'not_interested' }))
    expect((await queueBroadcast('B')).queued).toBe(3)
    resetWorld(seed({ leads: [lead('L5', '9810001028', { stage: 'closed_won' })], whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'admin1', audience_filters: { stage: ['closed_won'] }, template: tpl() }] }), {}, null)
    expect((await queueBroadcast('B')).queued).toBe(1)
  })
  it('a lead not opted in to WhatsApp is skipped for every template category', async () => {
    world.db.rows('leads')[2].whatsapp_opt_in = false // L3, 9810001026
    const r = await queueBroadcast('B')
    expect(r).toMatchObject({ queued: 2, skipped: 1 })
    expect(world.db.rows('whatsapp_broadcast_recipients').find((x) => x.phone === '919810001026')).toMatchObject({ status: 'failed', skipped_opted_out: true, failed_reason: expect.stringMatching(/not opted in/) })
    resetWorld(seed({ whatsapp_broadcasts: [{ id: 'B', status: 'draft', created_by: 'admin1', audience_filters: {}, template: tpl({ category: 'utility' }) }] }), {}, null)
    world.db.rows('leads')[2].whatsapp_opt_in = false
    expect((await queueBroadcast('B')).queued).toBe(2)
  })
  it('a broadcast can only be started once, even by two callers at the same time', async () => {
    const [a, b] = await Promise.all([queueBroadcast('B'), queueBroadcast('B')])
    expect([a.success, b.success].filter(Boolean)).toHaveLength(1)
    expect(world.db.rows('whatsapp_broadcast_recipients')).toHaveLength(3)
  })
  it('a failed start rolls back to draft with the reason, and a scheduled run tells its creator', async () => {
    world.db.rows('whatsapp_broadcasts')[0].status = 'scheduled'
    world.db.rows('whatsapp_broadcasts')[0].template = tpl({ status: 'pending_approval' })
    const r = await queueBroadcast('B', { notifyOnFailure: true })
    expect(r.success).toBe(false)
    expect(world.db.rows('whatsapp_broadcasts')[0]).toMatchObject({ status: 'draft', last_error: expect.stringMatching(/not approved/) })
    expect(world.db.rows('whatsapp_broadcast_recipients')).toHaveLength(0)
    expect(world.db.rows('notifications').some((n) => n.user_id === 'admin1')).toBe(true)
  })
  it('a start that died mid-queue is recovered by the cron', async () => {
    world.db.rows('whatsapp_broadcasts')[0].status = 'queueing'
    world.db.rows('whatsapp_broadcasts')[0].updated_at = new Date(Date.now() - 60 * 60_000).toISOString()
    world.db.rows('whatsapp_broadcast_recipients').push({ broadcast_id: 'B', phone: '1', status: 'queued' })
    const r = await runDueBroadcasts(1000)
    expect(r.recovered).toBe(1)
    expect(world.db.rows('whatsapp_broadcasts')[0]).toMatchObject({ status: 'draft', last_error: expect.stringMatching(/interrupted/) })
    expect(world.db.rows('whatsapp_broadcast_recipients')).toHaveLength(0)
  })
  it('filters from the browser are reduced to the known keys and shapes', () => {
    expect(sanitizeAudienceFilters({ stage: ['contacted', 7, ''], city: '  Jaipur ', budget_min: '-5', budget_max: '5000000', evil: 'x', variables: { offer: ' 10% ', blank: ' ' } }))
      .toEqual({ stage: ['contacted'], city: 'Jaipur', budget_max: 5000000, variables: { offer: '10%' } })
    expect(sanitizeAudienceFilters('nonsense')).toEqual({})
  })
})

describe('outages, retries and cancelling', () => {
  beforeEach(async () => { calls.length = 0; nextResult = () => ({ success: true, messageId: 'wamid.X', to: '1' }); resetWorld(seed(), {}, null); await queueBroadcast('B') })

  it('an outage stops the batch and leaves the rows queued instead of failing them', async () => {
    nextResult = (i) => (i === 2 ? { success: false, retryable: true, error: 'AgencyX send failed (502)' } : { success: true, messageId: 'w' + i, to: '1' })
    const r = await processBroadcast('B')
    expect(r).toMatchObject({ sent: 1, failed: 0, remaining: 2, error: expect.stringMatching(/502/) })
    expect(world.db.rows('whatsapp_broadcast_recipients').filter((x) => x.status === 'failed')).toHaveLength(0)
    expect(world.db.rows('whatsapp_broadcasts')[0]).toMatchObject({ status: 'sending', last_error: expect.stringMatching(/Paused/) })
  })
  it('retry re-queues send-time failures only, not opt-outs, missing values, cancellations or rejected deliveries', async () => {
    await processBroadcast('B')
    const rows = world.db.rows('whatsapp_broadcast_recipients')
    Object.assign(rows[0], { status: 'failed', failed_reason: 'timeout', wa_message_id: null })
    Object.assign(rows[1], { status: 'failed', failed_reason: 'Opted out of WhatsApp', skipped_opted_out: true, wa_message_id: null })
    Object.assign(rows[2], { status: 'failed', failed_reason: 'Undeliverable', wa_message_id: 'wamid.rejected' })
    const r = await requeueFailedRecipients('B')
    expect(r).toMatchObject({ success: true, requeued: 1 })
    expect(rows[0].status).toBe('queued')
    expect(world.db.rows('whatsapp_broadcasts')[0].status).toBe('sending')
    calls.length = 0
    await processBroadcast('B')
    expect(calls).toHaveLength(1)
    expect((await requeueFailedRecipients('B')).success).toBe(false)
  })
  it('a cancelled broadcast stops sending at the next batch', async () => {
    world.db.rows('whatsapp_broadcasts')[0].status = 'cancelled'
    const r = await processBroadcast('B')
    expect(r.sent).toBe(0)
    expect(calls).toHaveLength(0)
  })
})
