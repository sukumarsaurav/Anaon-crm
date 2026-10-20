import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { ingestLead, INVALID_PHONE } from '@/lib/leads/ingest'
import { resolveAssignee } from '@/lib/leads/assignment'
import { createLead, updateLead, changeLeadStage, logActivity, assignLead, bulkAssignLeads, bulkChangeStage, deleteLead, scheduleFollowUp, mergeDuplicate } from '@/lib/leads/actions'
import { scheduleSiteVisit, recordSiteVisitOutcome } from '@/lib/leads/siteVisits'

const adv = (id: string, extra: any = {}) => ({ id, role: 'sales_advisor', is_active: true, full_name: id, ...extra })
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }

describe('lead intake (ingestLead)', () => {
  beforeEach(() => resetWorld({ profiles: [adv('a1'), adv('a2')], leads: [], lead_activities: [], assignment_rules: [] }))

  it('creates a normalised, scored, assigned lead with a timeline entry, notifies the advisor and fires lead_created', async () => {
    const r = await ingestLead({ source: 'facebook_ads', full_name: ' Ravi ', phone: '+91 98100-01025', requirement: 'wants 2BHK', project_id: 'p1' })
    expect(r.ok).toBe(true)
    const lead = world.db.rows('leads')[0]
    expect(lead).toMatchObject({ full_name: 'Ravi', phone: '9810001025', stage: 'new_lead', source: 'facebook_ads' })
    expect(['a1', 'a2']).toContain(lead.assigned_to)
    expect(world.db.rows('lead_activities')[0].notes).toContain('wants 2BHK')
    expect(world.notifications[0].ids).toEqual([lead.assigned_to])
    expect(world.automations[0]).toMatchObject({ trigger: 'lead_created' })
    expect(world.automations[0].ctx.lead.project_id).toBe('p1')
  })
  it('rejects an unusable phone with the retry-proof error', async () => {
    expect(await ingestLead({ source: 'manual', full_name: 'x', phone: '123' })).toEqual({ ok: false, error: INVALID_PHONE })
    expect(world.db.rows('leads')).toHaveLength(0)
  })
  it('de-duplicates on the last 10 digits even when the stored phone is formatted', async () => {
    world.db.rows('leads').push({ id: 'old', phone: '+91-9810001025', is_active: true, created_at: '2026-01-01' })
    const r = await ingestLead({ source: 'whatsapp', full_name: 'Ravi', phone: '9810001025', requirement: 'hi again' })
    expect(r).toMatchObject({ ok: true, id: 'old', duplicate: true })
    expect(world.db.rows('leads')).toHaveLength(1)
    expect(world.db.rows('lead_activities')[0].notes).toContain('Repeat inquiry')
  })
  it("onDuplicate 'ignore' adds nothing for chat sources", async () => {
    world.db.rows('leads').push({ id: 'old', phone: '9810001025', is_active: true })
    await ingestLead({ source: 'whatsapp', phone: '9810001025', onDuplicate: 'ignore' })
    expect(world.db.rows('lead_activities')).toHaveLength(0)
  })
  it('an inactive (deleted/erased) lead is not a duplicate', async () => {
    world.db.rows('leads').push({ id: 'gone', phone: '9810001025', is_active: false })
    const r = await ingestLead({ source: 'manual', full_name: 'New', phone: '9810001025' })
    expect(r.duplicate).toBeUndefined()
    expect(world.db.rows('leads')).toHaveLength(2)
  })
  it('missing name becomes "Unknown Lead"', async () => {
    await ingestLead({ source: 'manual', phone: '9810001025' })
    expect(world.db.rows('leads')[0].full_name).toBe('Unknown Lead')
  })
})

describe('assignment rules', () => {
  const lead = { source: 'facebook_ads', city: 'Jaipur', property_type: 'plot', budget_min: 2e6, budget_max: 4e6 }
  const rule = (o: any) => ({ id: o.id ?? 'r', name: 'r', priority: 10, is_active: true, match_sources: null, match_property_types: null, match_cities: null, budget_min: null, budget_max: null, assign_mode: 'specific', assign_to: 'a2', assign_pool: null, branch_id: null, created_at: '2026-01-01', ...o })

  it('first matching rule by priority wins; specific target must be active', async () => {
    const db = resetWorld({ profiles: [adv('a1'), adv('a2'), adv('a3', { is_active: false })], leads: [], assignment_rules: [rule({ id: 'x', priority: 5, match_sources: ['google_ads'], assign_to: 'a1' }), rule({ id: 'y', priority: 6, match_cities: ['jaipur'], assign_to: 'a2' })] })
    expect(await resolveAssignee(db as any, lead)).toBe('a2')
  })
  it('skips a rule whose target is deactivated and falls through', async () => {
    const db = resetWorld({ profiles: [adv('a1'), adv('a3', { is_active: false })], leads: [], assignment_rules: [rule({ priority: 1, assign_to: 'a3' })] })
    expect(await resolveAssignee(db as any, lead)).toBe('a1')
  })
  it('budget rule matches by range overlap', async () => {
    const db = resetWorld({ profiles: [adv('a1'), adv('a2')], leads: [], assignment_rules: [rule({ budget_min: 5e6, budget_max: 9e6, assign_to: 'a2' })] })
    expect(await resolveAssignee(db as any, { ...lead, budget_min: 1e6, budget_max: 2e6 })).toBe('a1') // no match → fallback
    expect(await resolveAssignee(db as any, { ...lead, budget_min: 4e6, budget_max: 6e6 })).toBe('a2')
  })
  it('round-robin picks the advisor with the fewest open leads (closed ones do not count)', async () => {
    const db = resetWorld({
      profiles: [adv('a1'), adv('a2')],
      leads: [{ assigned_to: 'a1', is_active: true, stage: 'contacted' }, { assigned_to: 'a1', is_active: true, stage: 'interested' }, { assigned_to: 'a2', is_active: true, stage: 'contacted' }, { assigned_to: 'a2', is_active: true, stage: 'closed_won' }, { assigned_to: 'a2', is_active: true, stage: 'not_interested' }],
      assignment_rules: [],
    })
    expect(await resolveAssignee(db as any, lead)).toBe('a2')
  })
  it('returns null (unassigned) when there is nobody to assign to', async () => {
    const db = resetWorld({ profiles: [], leads: [], assignment_rules: [] })
    expect(await resolveAssignee(db as any, lead)).toBeNull()
  })
  it('a deactivated advisor never receives a lead', async () => {
    const db = resetWorld({ profiles: [adv('off', { is_active: false })], leads: [], assignment_rules: [] })
    expect(await resolveAssignee(db as any, lead)).toBeNull()
  })
})

describe('manual lead create / edit', () => {
  beforeEach(() => resetWorld({ profiles: [adv('a1')], leads: [], lead_activities: [], assignment_rules: [], audit_logs: [] }, {}, 'sales_advisor', 'me'))

  it('createLead scores, assigns, logs, audits, notifies and fires lead_created', async () => {
    const r = await createLead(fd({ full_name: 'Sita', phone: '98100 01025', source: 'walk_in', assigned_to: 'a1' }))
    expect(r.success).toBe(true)
    const lead = world.db.rows('leads')[0]
    expect(lead).toMatchObject({ assigned_to: 'a1', source: 'walk_in', score: 15, created_by: 'me' })
    expect(world.db.rows('audit_logs')).toHaveLength(1)
    expect(world.notifications[0].ids).toEqual(['a1'])
    expect(world.automations.map((a) => a.trigger)).toContain('lead_created')
  })
  it('scoring uses the project’s real price range: a budget inside it is +20, one far outside is −15', async () => {
    world.db.rows('plots') // ensure table exists
    world.db.tables.plots = [{ id: 'p1', project_id: 'PR', status: 'available', total_price: 3000000 }, { id: 'p2', project_id: 'PR', status: 'available', total_price: 6000000 }, { id: 'p3', project_id: 'PR', status: 'booked', total_price: 100 }]
    await createLead(fd({ full_name: 'In', phone: '9810001001', source: 'walk_in', project_id: 'PR', budget_min: '4000000', budget_max: '5000000' }))
    await createLead(fd({ full_name: 'Out', phone: '9810001002', source: 'walk_in', project_id: 'PR', budget_min: '10000', budget_max: '20000' }))
    expect(world.db.rows('leads').find((l) => l.full_name === 'In')!.score).toBe(35)   // walk-in 15 + budget match 20
    expect(world.db.rows('leads').find((l) => l.full_name === 'Out')!.score).toBe(0)   // 15 − 15
  })
  it('stores the phone as 10 digits so it can be de-duplicated later', async () => {
    await createLead(fd({ full_name: 'Sita', phone: '+91 98100-01025' }))
    expect(world.db.rows('leads')[0].phone).toBe('9810001025')
  })
  it('does not notify yourself when you assign a lead to yourself', async () => {
    await createLead(fd({ full_name: 'Sita', phone: '9810001025', assigned_to: 'me' }))
    expect(world.notifications).toHaveLength(0)
  })
  it('updateLead only accepts the edit-form fields', async () => {
    world.db.rows('leads').push({ id: 'L', full_name: 'Old', phone: '9810001025', assigned_to: 'a1', stage: 'new_lead', is_active: true, created_by: 'x', source: 'manual' })
    const r = await updateLead('L', { full_name: 'New', assigned_to: 'hacker', stage: 'closed_won', is_active: false, created_by: 'me', score: 99 } as any)
    expect(r.success).toBe(true)
    expect(world.db.rows('leads')[0]).toMatchObject({ full_name: 'New', assigned_to: 'a1', stage: 'new_lead', is_active: true, created_by: 'x' })
    expect(world.db.rows('leads')[0].score).not.toBe(99)
  })
  it('updateLead on a missing lead fails cleanly', async () => {
    expect((await updateLead('nope', { full_name: 'x' })).success).toBe(false)
  })
  it('requires a session', async () => {
    resetWorld({}, {}, null)
    expect((await createLead(fd({ full_name: 'x', phone: '9810001025' }))).success).toBe(false)
    expect((await changeLeadStage('L', 'contacted')).success).toBe(false)
    expect((await bulkAssignLeads(['L'], 'a1')).success).toBe(false)
  })
})

describe('stage changes and activity logging', () => {
  beforeEach(() => resetWorld({ profiles: [adv('a1')], leads: [{ id: 'L', full_name: 'Sita', phone: '9810001025', stage: 'new_lead', score: 0, follow_up_count: 0, is_active: true, assigned_to: 'a1', created_at: '2026-10-01T10:00:00Z' }], lead_activities: [], audit_logs: [] }, {}, 'sales_advisor', 'me'))

  it('changeLeadStage updates, rescoring, logs from/to and fires lead_stage_changed', async () => {
    expect((await changeLeadStage('L', 'negotiation')).success).toBe(true)
    expect(world.db.rows('leads')[0]).toMatchObject({ stage: 'negotiation', score: 25, loss_reason: null })
    expect(world.db.rows('lead_activities')[0]).toMatchObject({ type: 'stage_change', stage_from: 'new_lead', stage_to: 'negotiation' })
    expect(world.automations.map((a) => a.trigger)).toEqual(['lead_stage_changed'])
  })
  it('keeps a loss reason only for "not interested" and clears it otherwise', async () => {
    await changeLeadStage('L', 'not_interested', undefined, 'Budget')
    expect(world.db.rows('leads')[0].loss_reason).toBe('Budget')
    await changeLeadStage('L', 'interested')
    expect(world.db.rows('leads')[0].loss_reason).toBeNull()
  })
  it('logActivity bumps follow_up_count, stamps last_contacted and schedules the next follow-up', async () => {
    const r = await logActivity(fd({ lead_id: 'L', type: 'call', outcome: 'not_reachable', notes: 'rang' }))
    expect(r.success).toBe(true)
    const lead = world.db.rows('leads')[0]
    expect(lead.follow_up_count).toBe(1)
    expect(lead.last_contacted_at).toBeTruthy()
    expect(new Date(lead.next_followup_at).getTime()).toBeGreaterThan(Date.now())
    await logActivity(fd({ lead_id: 'L', type: 'call', outcome: 'connected_interested' }))
    expect(world.db.rows('leads')[0].follow_up_count).toBe(2)
  })
  it('an explicit follow-up time wins and resets the reminder stamp', async () => {
    world.db.rows('leads')[0].followup_reminder_sent_at = '2026-10-01'
    await logActivity(fd({ lead_id: 'L', type: 'call', schedule_followup: 'true', followup_at: '2030-01-01T10:00:00Z' }))
    expect(world.db.rows('leads')[0]).toMatchObject({ next_followup_at: '2030-01-01T10:00:00Z', followup_reminder_sent_at: null })
  })
  it('a follow-up typed in a date-time field (no zone) is IST: 7:56 PM IST is stored as 14:26 UTC', async () => {
    await logActivity(fd({ lead_id: 'L', type: 'call', schedule_followup: 'true', followup_at: '2030-01-01T19:56' }))
    expect(world.db.rows('leads')[0].next_followup_at).toBe('2030-01-01T14:26:00.000Z')
  })
  it('scheduleFollowUp resets the reminder stamp', async () => {
    world.db.rows('leads')[0].followup_reminder_sent_at = 'x'
    await scheduleFollowUp('L', '2030-02-02T00:00:00Z')
    expect(world.db.rows('leads')[0]).toMatchObject({ next_followup_at: '2030-02-02T00:00:00Z', followup_reminder_sent_at: null })
  })
  it('assignLead logs, notifies the new advisor and fires lead_assigned', async () => {
    world.db.rows('profiles').push(adv('a2', { full_name: 'Two' }))
    await assignLead('L', 'a2')
    expect(world.db.rows('leads')[0].assigned_to).toBe('a2')
    expect(world.db.rows('lead_activities')[0]).toMatchObject({ type: 'assignment' })
    expect(world.notifications[0].ids).toEqual(['a2'])
    expect(world.automations[0].trigger).toBe('lead_assigned')
  })
})

describe('bulk actions', () => {
  beforeEach(() => resetWorld({
    profiles: [adv('a1'), adv('a2', { full_name: 'Two' })],
    leads: [1, 2, 3].map((n) => ({ id: `L${n}`, full_name: `Lead ${n}`, phone: `98100000${n}0`, stage: 'contacted', assigned_to: 'a1', is_active: true, loss_reason: 'x' })),
    lead_activities: [],
  }, {}, 'manager', 'mgr'))

  it('bulkAssign moves only leads that change owner, logs each and sends ONE notification', async () => {
    world.db.rows('leads')[2].assigned_to = 'a2'
    const r = await bulkAssignLeads(['L1', 'L2', 'L3'], 'a2')
    expect(r).toMatchObject({ success: true, count: 2 })
    expect(world.db.rows('leads').map((l) => l.assigned_to)).toEqual(['a2', 'a2', 'a2'])
    expect(world.db.rows('lead_activities')).toHaveLength(2)
    expect(world.notifications).toHaveLength(1)
  })
  it('bulkAssign with nothing selected / too many', async () => {
    expect((await bulkAssignLeads([], 'a2')).success).toBe(false)
    expect((await bulkAssignLeads(Array(501).fill('x'), 'a2')).success).toBe(false)
  })
  it('bulkChangeStage validates the stage, logs from/to, clears loss reason and fires automations per lead', async () => {
    expect((await bulkChangeStage(['L1'], 'banana')).success).toBe(false)
    const r = await bulkChangeStage(['L1', 'L2'], 'interested')
    expect(r).toMatchObject({ success: true, count: 2 })
    expect(world.db.rows('leads').slice(0, 2).every((l) => l.stage === 'interested' && l.loss_reason === null)).toBe(true)
    expect(world.db.rows('lead_activities')[0]).toMatchObject({ stage_from: 'contacted', stage_to: 'interested' })
    expect(world.automations.filter((a) => a.trigger === 'lead_stage_changed')).toHaveLength(2)
  })
  it('bulkChangeStage skips leads already in that stage', async () => {
    expect((await bulkChangeStage(['L1'], 'contacted')).count).toBe(0)
  })
})

describe('delete and merge', () => {
  it('only admins can delete, and it is a soft delete', async () => {
    resetWorld({ leads: [{ id: 'L', is_active: true }], audit_logs: [] }, {}, 'manager')
    expect((await deleteLead('L')).success).toBe(false)
    resetWorld({ leads: [{ id: 'L', is_active: true }], audit_logs: [] }, {}, 'admin')
    expect((await deleteLead('L')).success).toBe(true)
    expect(world.db.rows('leads')[0].is_active).toBe(false)
  })
  it('merge re-parents everything, keeps the higher score, backfills blanks and retires the duplicate', async () => {
    resetWorld({
      leads: [{ id: 'K', full_name: 'Keep', phone: '1', score: 10, email: null, is_active: true }, { id: 'D', full_name: 'Dupe', phone: '2', score: 70, email: 'd@x.in', is_active: true }],
      lead_activities: [{ id: 'a', lead_id: 'D' }], site_visits: [{ id: 's', lead_id: 'D' }], clients: [{ id: 'c', lead_id: 'D' }],
      whatsapp_conversations: [{ id: 'w', lead_id: 'D' }], broker_lead_registrations: [{ id: 'b', crm_lead_id: 'D' }],
    }, {}, 'manager')
    expect((await mergeDuplicate('K', 'D')).success).toBe(true)
    expect(world.db.rows('lead_activities')[0].lead_id).toBe('K')
    expect(world.db.rows('site_visits')[0].lead_id).toBe('K')
    expect(world.db.rows('clients')[0].lead_id).toBe('K')
    expect(world.db.rows('whatsapp_conversations')[0].lead_id).toBe('K')
    expect(world.db.rows('broker_lead_registrations')[0].crm_lead_id).toBe('K')
    expect(world.db.rows('leads').find((l) => l.id === 'K')).toMatchObject({ score: 70, email: 'd@x.in' })
    expect(world.db.rows('leads').find((l) => l.id === 'D')).toMatchObject({ is_active: false, is_duplicate: true, duplicate_of: 'K' })
  })
  it('merge is manager-only and refuses self-merge', async () => {
    resetWorld({ leads: [] }, {}, 'sales_advisor')
    expect((await mergeDuplicate('a', 'b')).success).toBe(false)
    resetWorld({ leads: [] }, {}, 'manager')
    expect((await mergeDuplicate('a', 'a')).success).toBe(false)
  })
})

describe('site visits', () => {
  beforeEach(() => resetWorld({ leads: [{ id: 'L', stage: 'interested', full_name: 'S', phone: '9810001025', assigned_to: 'a1' }], site_visits: [], lead_activities: [] }, {}, 'sales_advisor', 'me'))

  it('scheduling advances the stage forward, sets the follow-up to the visit time and fires site_visit_scheduled', async () => {
    const r = await scheduleSiteVisit(fd({ lead_id: 'L', scheduled_at: '2030-03-03T10:00:00Z' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('leads')[0]).toMatchObject({ stage: 'site_visit_scheduled', next_followup_at: '2030-03-03T10:00:00Z' })
    expect(world.db.rows('site_visits')[0]).toMatchObject({ status: 'scheduled', accompanied_by: 'me' })
    expect(world.automations[0].trigger).toBe('site_visit_scheduled')
  })
  it('never moves a lead BACKWARD in the pipeline', async () => {
    world.db.rows('leads')[0].stage = 'negotiation'
    await scheduleSiteVisit(fd({ lead_id: 'L', scheduled_at: '2030-03-03T10:00:00Z' }))
    expect(world.db.rows('leads')[0].stage).toBe('negotiation')
  })
  it('a site visit time typed without a zone is IST', async () => {
    await scheduleSiteVisit(fd({ lead_id: 'L', scheduled_at: '2030-03-03T10:00' }))
    expect(world.db.rows('site_visits')[0].scheduled_at).toBe('2030-03-03T04:30:00.000Z')
    expect(world.db.rows('leads')[0].next_followup_at).toBe('2030-03-03T04:30:00.000Z')
  })
  it('requires lead and time', async () => {
    expect((await scheduleSiteVisit(fd({ lead_id: 'L' }))).success).toBe(false)
  })
  it('completed visit advances to site_visit_done and fires site_visit_completed; no-show does not', async () => {
    await scheduleSiteVisit(fd({ lead_id: 'L', scheduled_at: '2030-03-03T10:00:00Z' }))
    world.automations.length = 0
    const visit = world.db.rows('site_visits')[0]
    await recordSiteVisitOutcome(fd({ visit_id: visit.id, lead_id: 'L', status: 'no_show' }))
    expect(world.db.rows('leads')[0].stage).toBe('site_visit_scheduled')
    expect(world.automations).toHaveLength(0)
    await recordSiteVisitOutcome(fd({ visit_id: visit.id, lead_id: 'L', status: 'completed', client_feedback: 'liked it', followup_at: '2030-04-01T00:00:00Z' }))
    expect(world.db.rows('leads')[0]).toMatchObject({ stage: 'site_visit_done', next_followup_at: '2030-04-01T00:00:00Z' })
    expect(world.db.rows('site_visits')[0]).toMatchObject({ status: 'completed', visited_by: 'me' })
    expect(world.automations.map((a) => a.trigger)).toEqual(['site_visit_completed'])
  })
})
