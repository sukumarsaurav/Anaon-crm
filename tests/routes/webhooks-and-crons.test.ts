import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

const req = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
  new NextRequest(`http://localhost${url}`, { method: init.method ?? 'POST', headers: init.headers, body: init.body })
const json = async (r: Response) => ({ status: r.status, body: await r.json().catch(() => null) })

describe('lead webhook /api/webhooks/leads/[source]', async () => {
  const { POST } = await import('@/app/api/webhooks/leads/[source]/route')
  beforeEach(() => resetWorld({ profiles: [{ id: 'a1', role: 'sales_advisor', is_active: true }], leads: [], lead_activities: [], assignment_rules: [] }))
  const call = (slug: string, body: any, token: string | null = 'lead-secret') =>
    POST(req(`/api/webhooks/leads/${slug}${token ? `?token=${token}` : ''}`, { body: JSON.stringify(body) }), { params: Promise.resolve({ source: slug }) })

  it('rejects a missing or wrong token (fails closed)', async () => {
    expect((await json(await call('99acres', { phone: '9810001025' }, null))).status).toBe(401)
    expect((await json(await call('99acres', { phone: '9810001025' }, 'wrong'))).status).toBe(401)
    expect(world.db.rows('leads')).toHaveLength(0)
  })
  it('rejects an unknown source', async () => {
    expect((await json(await call('mystery', { phone: '9810001025' }))).status).toBe(404)
  })
  it('creates a lead from common portal field names', async () => {
    const r = await json(await call('magicbricks', { Name: 'Ravi', Mobile: '+91 9810001025', query: 'plot', budget: '₹45,00,000', city: 'Jaipur' }))
    expect(r.status).toBe(200)
    expect(world.db.rows('leads')[0]).toMatchObject({ full_name: 'Ravi', phone: '9810001025', source: 'magicbricks', city: 'Jaipur', budget_max: 4500000 })
  })
  it('a repeat enquiry is reported as duplicate, not created twice', async () => {
    await call('justdial', { name: 'A', phone: '9810001025' })
    const r = await json(await call('justdial', { name: 'A', phone: '9810001025' }))
    expect(r.body).toMatchObject({ ok: true, duplicate: true })
    expect(world.db.rows('leads')).toHaveLength(1)
  })
  it('422 for an unusable phone, 400 for bad JSON', async () => {
    expect((await json(await call('housing', { name: 'x', phone: '12' }))).status).toBe(422)
    const bad = await POST(req('/api/webhooks/leads/housing?token=lead-secret', { body: '{not json' }), { params: Promise.resolve({ source: 'housing' }) })
    expect(bad.status).toBe(400)
  })
})

describe('AgencyX webhook', async () => {
  const { POST } = await import('@/app/api/webhooks/agencyx/route')
  beforeEach(() => resetWorld({ profiles: [{ id: 'a1', role: 'sales_advisor', is_active: true }], leads: [], lead_activities: [], assignment_rules: [], whatsapp_conversations: [], whatsapp_messages: [], whatsapp_templates: [{ id: 't', name: 'welcome', language: 'en', status: 'pending_approval' }], whatsapp_broadcast_recipients: [] }))
  const sign = (body: string, t = Math.floor(Date.now() / 1000), secret = 'agencyx-secret') => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
  const send = (event: string, payload: any, headers: Record<string, string> = {}) => {
    const body = JSON.stringify(payload)
    return POST(req('/api/webhooks/agencyx', { body, headers: { 'x-agencyx-event': event, 'x-agencyx-signature': sign(body), ...headers } }))
  }

  it('rejects bad, missing, stale and wrong-secret signatures', async () => {
    const body = JSON.stringify({ event: 'ping' })
    expect((await POST(req('/api/webhooks/agencyx', { body }))).status).toBe(401)
    expect((await POST(req('/api/webhooks/agencyx', { body, headers: { 'x-agencyx-signature': sign(body, Math.floor(Date.now() / 1000) - 3600) } }))).status).toBe(401)
    expect((await POST(req('/api/webhooks/agencyx', { body, headers: { 'x-agencyx-signature': sign(body, undefined, 'nope') } }))).status).toBe(401)
  })
  it('accepts a signature during secret rotation (two v1 values)', async () => {
    const body = JSON.stringify({ event: 'ping' }); const t = Math.floor(Date.now() / 1000)
    const good = createHmac('sha256', 'agencyx-secret').update(`${t}.${body}`).digest('hex')
    const r = await POST(req('/api/webhooks/agencyx', { body, headers: { 'x-agencyx-signature': `t=${t},v1=deadbeef,v1=${good}` } }))
    expect(r.status).toBe(200)
  })
  it('ping and unknown events are acknowledged, not retried', async () => {
    expect((await json(await send('ping', {}))).body).toMatchObject({ ok: true })
    expect((await json(await send('something.new', {}))).status).toBe(200)
  })
  it('a lead-ad event becomes a facebook lead with the answers in the first note', async () => {
    const r = await json(await send('meta.lead.received', { source: { platform: 'facebook', campaign_name: 'Diwali', ad_name: 'Ad1' }, lead: { full_name: 'Ravi', phone: '+919810001025', answers: [{ key: 'budget', value: '50L' }, { key: 'email', value: 'x@y.in' }] } }))
    expect(r.body).toMatchObject({ ok: true })
    expect(world.db.rows('leads')[0]).toMatchObject({ source: 'facebook_ads', campaign_name: 'Diwali' })
    expect(world.db.rows('lead_activities')[0].notes).toContain('Budget: 50L')
    expect(world.db.rows('lead_activities')[0].notes).not.toContain('Email:')
  })
  it('instagram events are tagged instagram_ads', async () => {
    await send('meta.lead.received', { source: { platform: 'instagram', is_organic: true }, lead: { full_name: 'R', phone: '9810001026' } })
    expect(world.db.rows('leads')[0]).toMatchObject({ source: 'instagram_ads', utm_medium: 'organic_social' })
  })
  it('an invalid phone is acknowledged (skipped) so AgencyX does not retry for eight hours', async () => {
    const r = await json(await send('meta.lead.received', { lead: { full_name: 'R', phone: '12' } }))
    expect(r).toMatchObject({ status: 200, body: { ok: false } })
  })
  it('an inbound WhatsApp message creates one lead and mirrors the message; a second message adds nothing', async () => {
    const ev = (id: string) => ({ channel: { phone_number_id: 'pn' }, contact: { wa_id: '919810001025', phone: '919810001025', name: 'Ravi' }, message: { id, type: 'text', text: 'price?', timestamp: new Date().toISOString() } })
    await send('whatsapp.message.received', ev('wamid.1'))
    await send('whatsapp.message.received', ev('wamid.2'))
    expect(world.db.rows('leads')).toHaveLength(1)
    expect(world.db.rows('whatsapp_conversations')).toHaveLength(1)
    expect(world.db.rows('whatsapp_messages')).toHaveLength(2)
    expect(world.db.rows('whatsapp_conversations')[0]).toMatchObject({ source: 'agencyx', unread_count: 2 })
  })
  it('redelivering the SAME message does not double-count it', async () => {
    const p = { contact: { wa_id: '919810001025', name: 'R' }, message: { id: 'wamid.1', type: 'text', text: 'hi', timestamp: new Date().toISOString() } }
    await send('whatsapp.message.received', p)
    await send('whatsapp.message.received', p)
    expect(world.db.rows('whatsapp_messages')).toHaveLength(1)
    expect(world.db.rows('whatsapp_conversations')[0].unread_count).toBe(1)
  })
  it('opt-out events flip the conversation flag', async () => {
    const p = { contact: { wa_id: '919810001025', name: 'R' }, message: { id: 'w1', type: 'text', text: 'STOP', timestamp: new Date().toISOString() } }
    await send('whatsapp.message.received', p)
    expect(world.db.rows('whatsapp_conversations')[0].opted_out).toBe(true)
  })
  it('chatbot.lead.captured enriches the lead', async () => {
    await send('chatbot.lead.captured', { chatbot: { name: 'Bot' }, lead: { full_name: 'R', phone: '9810001025', interest: '2BHK in Jaipur' } })
    expect(world.db.rows('lead_activities')[0].notes).toContain('2BHK in Jaipur')
  })
})

describe('Razorpay webhook', async () => {
  const { POST } = await import('@/app/api/webhooks/razorpay/route')
  const payload = (over: any = {}) => ({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', ...over } } } })
  const call = (body: any, sig?: string | null) => {
    const raw = JSON.stringify(body)
    const s = sig === undefined ? createHmac('sha256', 'rzp-secret').update(raw).digest('hex') : sig
    return POST(req('/api/webhooks/razorpay', { body: raw, headers: s ? { 'x-razorpay-signature': s } : {} }))
  }
  beforeEach(() => resetWorld({ payments: [{ id: 'PAY', razorpay_order_id: 'order_1', client_id: 'C1', booking_id: 'BK', amount_due: 100000, amount_paid: 0, status: 'pending' }], clients: [{ id: 'C1', full_name: 'Sita', phone: '9810001025' }] }))

  it('rejects a missing or forged signature', async () => {
    expect((await call(payload(), null)).status).toBe(401)
    expect((await call(payload(), 'ab'.repeat(32))).status).toBe(401)
    expect(world.db.rows('payments')[0].status).toBe('pending')
  })
  it('captured payment marks the installment paid exactly once and fires payment_received', async () => {
    expect((await json(await call(payload()))).body).toMatchObject({ status: 'ok' })
    expect(world.db.rows('payments')[0]).toMatchObject({ status: 'paid', amount_paid: 100000, mode: 'online', razorpay_payment_id: 'pay_1' })
    expect((await json(await call(payload()))).body).toMatchObject({ status: 'already_processed' })
    expect(world.automations.filter((a) => a.trigger === 'payment_received')).toHaveLength(1)
  })
  it('ignores other events and unknown orders', async () => {
    expect((await json(await call({ event: 'payment.failed' }))).body).toMatchObject({ status: 'ignored' })
    expect((await json(await call(payload({ order_id: 'other' })))).body).toMatchObject({ status: 'no_matching_payment' })
  })
})

describe('Exotel webhook', async () => {
  const mod = await import('@/app/api/webhooks/exotel/route')
  beforeEach(() => resetWorld({ leads: [{ id: 'L', phone: '+91-9810001025', is_active: true }], lead_activities: [{ id: 'act', lead_id: 'L', call_sid: 'CS1', type: 'call' }] }))

  it('needs the token (header or query) and fails closed', async () => {
    expect((await mod.POST(req('/api/webhooks/exotel', { body: 'CallSid=CS1' }))).status).toBe(401)
    expect((await mod.GET(req('/api/webhooks/exotel?CallSid=CS1&token=bad', { method: 'GET' }))).status).toBe(401)
  })
  it('completes the click-to-call activity with recording and duration', async () => {
    const r = await mod.POST(req('/api/webhooks/exotel?token=exotel-token', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CS1&Status=completed&ConversationDuration=42&RecordingUrl=https%3A%2F%2Frec%2F1.mp3' }))
    expect(r.status).toBe(200)
    expect(world.db.rows('lead_activities')[0]).toMatchObject({ recording_url: 'https://rec/1.mp3', call_duration_seconds: 42 })
  })
  it('logs an inbound call against the lead matched by phone', async () => {
    await mod.POST(req('/api/webhooks/exotel?token=exotel-token', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=NEW&From=09810001025&Status=completed&DialCallDuration=10' }))
    expect(world.db.rows('lead_activities')).toHaveLength(2)
    expect(world.db.rows('lead_activities')[1]).toMatchObject({ lead_id: 'L', call_sid: 'NEW', call_duration_seconds: 10 })
  })
})

describe('cron routes', () => {
  const auth = { authorization: 'Bearer cron-secret' }

  it('every cron route rejects missing/wrong secrets', async () => {
    resetWorld()
    for (const path of ['followup-reminders', 'site-visit-reminders', 'automations', 'broadcasts']) {
      const mod: any = await import(`@/app/api/cron/${path}/route`)
      expect((await mod.POST(req(`/api/cron/${path}`))).status).toBe(401)
      expect((await mod.POST(req(`/api/cron/${path}`, { headers: { authorization: 'Bearer nope' } }))).status).toBe(401)
    }
  })

  it('follow-up reminders: notifies the owner once, skips closed leads, stamps the reminder', async () => {
    const { POST } = await import('@/app/api/cron/followup-reminders/route')
    const past = new Date(Date.now() - 3600_000).toISOString()
    resetWorld({ leads: [
      { id: 'due', full_name: 'Due', phone: '1', stage: 'contacted', assigned_to: 'a1', next_followup_at: past, followup_reminder_sent_at: null, is_active: true },
      { id: 'done', full_name: 'Done', phone: '2', stage: 'closed_won', assigned_to: 'a1', next_followup_at: past, followup_reminder_sent_at: null, is_active: true },
      { id: 'nobody', full_name: 'N', phone: '3', stage: 'contacted', assigned_to: null, next_followup_at: past, followup_reminder_sent_at: null, is_active: true },
      { id: 'already', full_name: 'A', phone: '4', stage: 'contacted', assigned_to: 'a1', next_followup_at: past, followup_reminder_sent_at: past, is_active: true },
    ], lead_activities: [] })
    const r = await json(await POST(req('/api/cron/followup-reminders', { headers: auth })))
    expect(r.body).toMatchObject({ ok: true, notified: 1 })
    expect(world.notifications).toHaveLength(1)
    expect(world.db.rows('leads').find((l) => l.id === 'due')!.followup_reminder_sent_at).toBeTruthy()
    const again = await json(await POST(req('/api/cron/followup-reminders', { headers: auth })))
    expect(again.body.notified).toBe(0) // idempotent
  })

  it('site-visit reminders: only visits today (IST), once, and fires the dedicated reminder trigger', async () => {
    const { POST } = await import('@/app/api/cron/site-visit-reminders/route')
    const today = new Date().toISOString()
    resetWorld({ site_visits: [
      { id: 'v1', lead_id: 'L', scheduled_at: today, accompanied_by: 'a1', status: 'scheduled', reminded_at: null, leads: { full_name: 'S', phone: '9', assigned_to: 'a1' } },
      { id: 'v2', lead_id: 'L', scheduled_at: new Date(Date.now() + 5 * 86400000).toISOString(), accompanied_by: 'a1', status: 'scheduled', reminded_at: null, leads: { full_name: 'S', phone: '9', assigned_to: 'a1' } },
      { id: 'v3', lead_id: 'L', scheduled_at: today, accompanied_by: 'a1', status: 'completed', reminded_at: null, leads: { full_name: 'S', phone: '9', assigned_to: 'a1' } },
    ] })
    const r = await json(await POST(req('/api/cron/site-visit-reminders', { headers: auth })))
    expect(r.body.notified).toBe(1)
    expect(world.automations.map((a) => a.trigger)).toEqual(['site_visit_reminder'])
    expect((await json(await POST(req('/api/cron/site-visit-reminders', { headers: auth })))).body.notified).toBe(0)
  })

  it('automations cron: birthdays and anniversaries fire (date columns), overdue skips cancelled bookings', async () => {
    const { POST } = await import('@/app/api/cron/automations/route')
    const ist = new Date(Date.now() + 330 * 60000)
    const mmdd = ist.toISOString().slice(5, 10)
    const todayIst = ist.toISOString().slice(0, 10)
    const lastYear = `${ist.getUTCFullYear() - 1}-${mmdd}`
    const longAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)
    resetWorld({
      clients: [{ id: 'C1', full_name: 'Sita', phone: '9', date_of_birth: `1990-${mmdd}` }, { id: 'C2', full_name: 'Other', phone: '8', date_of_birth: '1990-01-01' }],
      bookings: [{ id: 'B1', booking_date: lastYear, status: 'confirmed', client_id: 'C1', project_id: 'P', clients: { full_name: 'Sita', phone: '9' } }, { id: 'B2', booking_date: todayIst, status: 'confirmed', client_id: 'C1', project_id: 'P', clients: { full_name: 'x', phone: '1' } }],
      payments: [
        { id: 'p-ok', due_date: longAgo, status: 'pending', amount_due: 10, client_id: 'C1', clients: { full_name: 'Sita', phone: '9' }, bookings: { status: 'confirmed' } },
        { id: 'p-cancelled', due_date: longAgo, status: 'pending', amount_due: 10, client_id: 'C1', clients: { full_name: 'Sita', phone: '9' }, bookings: { status: 'cancelled' } },
      ],
      leads: [], automation_pending_executions: [],
    })
    const r = await json(await POST(req('/api/cron/automations', { headers: auth })))
    expect(r.status).toBe(200)
    const fired = world.automations.map((a) => a.trigger)
    expect(fired).toContain('client_birthday')
    expect(fired.filter((t) => t === 'client_birthday')).toHaveLength(1)
    expect(fired.filter((t) => t === 'booking_anniversary')).toHaveLength(1) // not this year's booking
    const overdueIds = world.automations.filter((a) => a.trigger === 'payment_overdue').map((a) => a.ctx.payment.id)
    expect(overdueIds.every((id: string) => id !== 'p-cancelled')).toBe(true)
  })
})
