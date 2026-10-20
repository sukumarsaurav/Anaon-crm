import { world, resetWorld } from '../helpers/db'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const sent: any = { text: [], template: [], email: [], notify: [], outbound: [] }
vi.mock('@/lib/whatsapp/send', () => ({
  sendWhatsAppText: async (a: any) => { sent.text.push(a); return { success: true, to: '91' + a.to, messageId: 'm1' } },
  sendWhatsAppTemplate: async (a: any) => { sent.template.push(a); return { success: true, to: a.to, messageId: 'm2' } },
  isWhatsAppOptedOut: async (phone: string) => phone === 'optout',
  isMarketingCategory: (c?: string | null) => c === 'marketing',
  recordOutboundWhatsApp: async (a: any) => { sent.outbound.push(a) },
}))
vi.mock('@/lib/email/client', () => ({ emailConfigured: () => true, sendEmail: async (a: any) => { sent.email.push(a); return { success: true, id: 'e1' } } }))
vi.mock('@/lib/notifications/notify', () => ({ notifyUsers: async (ids: string[], input: any) => { sent.notify.push({ ids, input }) } }))

const { fireAutomations, runAutomation } = await import('@/lib/automation/engine')

const automation = (o: any = {}) => ({ id: 'A1', name: 'Auto', trigger_event: 'lead_created', is_active: true, conditions: [], delay_value: 0, delay_unit: 'minutes', action_type: 'send_whatsapp', action_payload: { recipient: 'lead', message_body: 'Hi {{lead_name}}' }, run_count: 0, ...o })
const lead = (o: any = {}) => ({ id: 'L1', full_name: 'Ravi', phone: '9810001025', source: 'facebook_ads', utm_source: 'facebook', stage: 'new_lead', assigned_to: 'a1', project_id: 'P1', ...o })

beforeEach(() => {
  for (const k of Object.keys(sent)) sent[k].length = 0
  resetWorld({ automations: [], automation_logs: [], automation_pending_executions: [], lead_activities: [], leads: [{ id: 'L1', stage: 'new_lead' }], profiles: [{ id: 'adm', role: 'admin', is_active: true }, { id: 'mgr', role: 'manager', is_active: true }, { id: 'off', role: 'admin', is_active: false }, { id: 'a1', role: 'sales_advisor', is_active: true }, { id: 'a2', role: 'sales_advisor', is_active: true }] })
})

describe('trigger matching', () => {
  it('runs every active automation for the trigger and ignores inactive / other triggers', async () => {
    world.db.rows('automations').push(automation(), automation({ id: 'A2', is_active: false }), automation({ id: 'A3', trigger_event: 'booking_created' }))
    await fireAutomations('lead_created', { lead: lead() }, 'lead', 'L1')
    expect(sent.text).toHaveLength(1)
    expect(world.db.rows('automation_logs')).toHaveLength(1)
    expect(world.db.rows('automations').find((a) => a.id === 'A1')).toMatchObject({ run_count: 1 })
  })
  it('no automations is a quiet no-op', async () => {
    await expect(fireAutomations('lead_created', { lead: lead() }, 'lead', 'L1')).resolves.toBeUndefined()
  })
  it('conditions: equals / not_equals / contains / greater_than; missing field fails closed', async () => {
    const cond = (field: string, operator: string, value: string) => [{ field, operator, value }]
    const cases: Array<[any[], any, boolean]> = [
      [cond('utm_source', 'equals', 'facebook'), lead(), true],
      [cond('utm_source', 'equals', 'google'), lead(), false],
      [cond('source', 'not_equals', 'walk_in'), lead(), true],
      [cond('source', 'contains', 'FACE'), lead(), true],
      [cond('score', 'greater_than', '50'), lead({ score: 80 }), true],
      [cond('score', 'less_than', '50'), lead({ score: 80 }), false],
      [cond('stage', 'equals', 'new_lead'), lead(), true],
      [cond('project_id', 'equals', 'P1'), lead(), true],
      [cond('utm_source', 'equals', 'facebook'), lead({ utm_source: undefined }), false],
      [[...cond('source', 'equals', 'facebook_ads'), ...cond('stage', 'equals', 'contacted')], lead(), false], // AND
    ]
    for (const [conditions, l, expected] of cases) {
      sent.text.length = 0
      world.db.tables.automations = [automation({ conditions })]
      await fireAutomations('lead_created', { lead: l }, 'lead', `L-${Math.random()}`)
      expect(sent.text.length > 0, JSON.stringify(conditions)).toBe(expected)
    }
  })
})

describe('actions', () => {
  const run = (a: any, ctx: any) => runAutomation(a, ctx, 'lead', 'L1')

  it('send_whatsapp text: fills tokens, honours the recipient, records the message', async () => {
    const r = await run(automation(), { lead: lead() })
    expect(r.success).toBe(true)
    expect(sent.text[0]).toMatchObject({ to: '9810001025', text: 'Hi Ravi' })
    expect(sent.outbound[0]).toMatchObject({ body: 'Hi Ravi', leadId: 'L1' })
  })
  it('falls back to the client when there is no lead; fails with no phone', async () => {
    expect((await run(automation({ action_payload: { message_body: 'x' } }), { client: { id: 'C', full_name: 'S', phone: '9999999999' } })).success).toBe(true)
    expect((await run(automation(), { lead: lead({ phone: undefined }) })).error).toBe('No phone number in context')
  })
  it('an opted-out contact gets no free text', async () => {
    expect((await run(automation(), { lead: lead({ phone: 'optout' }) })).error).toMatch(/opted out/)
    expect(sent.text).toHaveLength(0)
  })
  it('a template needs to be approved; variables are filled; marketing respects opt-out but utility does not', async () => {
    world.db.rows('whatsapp_templates')?.length
    world.db.tables.whatsapp_templates = [
      { id: 't1', name: 'welcome', language: 'en', category: 'marketing', status: 'approved', body: 'Hi {{name}}', variable_names: ['name'] },
      { id: 't2', name: 'receipt', language: 'en', category: 'utility', status: 'approved', body: 'Paid {{amount}}', variable_names: ['amount'] },
      { id: 't3', name: 'draft', language: 'en', category: 'marketing', status: 'draft', body: 'x', variable_names: [] },
    ]
    const tpl = (name: string) => automation({ action_payload: { recipient: 'lead', template_name: name } })
    expect((await run(tpl('welcome'), { lead: lead() })).success).toBe(true)
    expect(sent.template[0]).toMatchObject({ name: 'welcome', variables: ['Ravi'] })
    expect((await run(tpl('draft'), { lead: lead() })).error).toMatch(/not approved/)
    expect((await run(tpl('welcome'), { lead: lead({ phone: 'optout' }) })).error).toMatch(/opted out/)
    expect((await run(tpl('receipt'), { lead: lead({ phone: 'optout' }), payment: { id: 'p', amount_due: 5000 } })).success).toBe(true)
    // a template variable nothing can fill is reported, not sent blank
    world.db.tables.whatsapp_templates[0].variable_names = ['mystery']
    expect((await run(tpl('welcome'), { lead: lead() })).error).toMatch(/No value for template variable/)
  })
  it('send_notification fans out to active users of the chosen roles with tokens replaced everywhere', async () => {
    const a = automation({ action_type: 'send_notification', action_payload: { notify_roles: ['admin', 'manager'], notification_title: 'T', notification_body: '{{lead_name}} / {{lead_name}} owes {{amount}}' } })
    await run(a, { lead: lead(), payment: { id: 'p', amount_due: 500 } })
    expect(sent.notify[0].ids.sort()).toEqual(['adm', 'mgr'])
    expect(sent.notify[0].input.message).toBe('Ravi / Ravi owes 500')
  })
  it('create_followup writes a scheduled activity', async () => {
    await run(automation({ action_type: 'create_followup', action_payload: { followup_hours: 2 } }), { lead: lead() })
    const a = world.db.rows('lead_activities')[0]
    expect(a).toMatchObject({ type: 'follow_up', lead_id: 'L1' })
    expect(new Date(a.scheduled_at).getTime() - Date.now()).toBeLessThan(2.1 * 3600_000)
  })
  it('change_lead_stage updates and logs; refuses without a stage', async () => {
    expect((await run(automation({ action_type: 'change_lead_stage', action_payload: {} }), { lead: lead() })).success).toBe(false)
    await run(automation({ action_type: 'change_lead_stage', action_payload: { new_stage: 'contacted' } }), { lead: lead() })
    expect(world.db.rows('leads')[0].stage).toBe('contacted')
    expect(world.db.rows('lead_activities')[0]).toMatchObject({ stage_from: 'new_lead', stage_to: 'contacted' })
  })
  it('assign_to_advisor assigns, logs and notifies; a specific advisor wins over round-robin', async () => {
    await run(automation({ action_type: 'assign_to_advisor', action_payload: { advisor_id: 'a2' } }), { lead: lead() })
    expect(world.db.rows('leads')[0].assigned_to).toBe('a2')
    expect(sent.notify[0].ids).toEqual(['a2'])
    expect(world.db.rows('lead_activities')[0].type).toBe('assignment')
  })
  it('send_email: needs an address and configured email; escapes the body', async () => {
    const a = automation({ action_type: 'send_email', action_payload: { recipient: 'lead', email_subject: 'Hi {{lead_name}}', email_body: '<b>{{lead_name}}</b>' } })
    expect((await run(a, { lead: lead() })).error).toBe('No email address in context')
    expect((await run(a, { lead: lead({ email: 'r@x.in' }) })).success).toBe(true)
    expect(sent.email[0].subject).toBe('Hi Ravi')
    expect(sent.email[0].html).not.toContain('<b>Ravi</b>')
  })
  it('an unknown action type fails and is logged as failed', async () => {
    const r = await run(automation({ action_type: 'teleport' }), { lead: lead() })
    expect(r.success).toBe(false)
    expect(world.db.rows('automation_logs')[0]).toMatchObject({ status: 'failed' })
  })
})

describe('delays and de-duplication', () => {
  it('a delayed automation is queued with its context, not run', async () => {
    world.db.rows('automations').push(automation({ delay_value: 2, delay_unit: 'hours' }))
    await fireAutomations('lead_created', { lead: lead() }, 'lead', 'L1')
    expect(sent.text).toHaveLength(0)
    const p = world.db.rows('automation_pending_executions')[0]
    expect(p).toMatchObject({ status: 'pending', automation_id: 'A1', trigger_record_id: 'L1' })
    const wait = new Date(p.scheduled_for).getTime() - Date.now()
    expect(wait).toBeGreaterThan(1.9 * 3600_000); expect(wait).toBeLessThan(2.1 * 3600_000)
  })
  it('delay units: minutes, hours, days', async () => {
    for (const [unit, ms] of [['minutes', 60_000], ['hours', 3_600_000], ['days', 86_400_000]] as const) {
      world.db.tables.automation_pending_executions = []
      world.db.tables.automations = [automation({ delay_value: 3, delay_unit: unit })]
      await fireAutomations('lead_created', { lead: lead() }, 'lead', 'L1')
      const wait = new Date(world.db.rows('automation_pending_executions')[0].scheduled_for).getTime() - Date.now()
      expect(Math.abs(wait - 3 * ms)).toBeLessThan(5000)
    }
  })
  it('daily triggers act on a record once per day per automation (crons run every 15 minutes)', async () => {
    world.db.rows('automations').push(automation({ trigger_event: 'payment_overdue', action_payload: { recipient: 'client', message_body: 'pay' } }))
    const ctx = { client: { id: 'C', full_name: 'S', phone: '9999999999' }, payment: { id: 'PAY', amount_due: 1 } }
    await fireAutomations('payment_overdue', ctx as any, 'payment', 'PAY')
    await fireAutomations('payment_overdue', ctx as any, 'payment', 'PAY')
    await fireAutomations('payment_overdue', ctx as any, 'payment', 'PAY')
    expect(sent.text).toHaveLength(1)
  })
  it('event triggers are not de-duplicated (every stage change should run)', async () => {
    world.db.rows('automations').push(automation({ trigger_event: 'lead_stage_changed' }))
    await fireAutomations('lead_stage_changed', { lead: lead() }, 'lead', 'L1')
    await fireAutomations('lead_stage_changed', { lead: lead() }, 'lead', 'L1')
    expect(sent.text).toHaveLength(2)
  })
  it('a score condition works even though callers do not pass the score (it is loaded from the lead)', async () => {
    world.db.rows('leads')[0].score = 80
    world.db.rows('automations').push(automation({ conditions: [{ field: 'score', operator: 'greater_than', value: '70' }] }))
    await fireAutomations('lead_created', { lead: lead({ id: 'L1' }) }, 'lead', 'L1')
    expect(sent.text).toHaveLength(1)
    sent.text.length = 0
    world.db.rows('leads')[0].score = 20
    await fireAutomations('lead_created', { lead: lead({ id: 'L1' }) }, 'lead', 'L1b')
    expect(sent.text).toHaveLength(0)
  })
  it('an automation failing must never break the caller', async () => {
    world.db.rows('automations').push(automation({ action_type: 'send_notification', action_payload: {} }))
    ;(world.db as any).from = () => { throw new Error('db down') }
    await expect(fireAutomations('lead_created', { lead: lead() }, 'lead', 'L1')).resolves.toBeUndefined()
  })
})
