import { world, resetWorld } from '../helpers/world'
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { createPayrollRun } from '@/lib/hr/actions'
import { getMarketingStats } from '@/lib/marketing/queries'
import { createCampaign, updateCampaign, logCampaignSpend, updateCampaignStatus } from '@/lib/marketing/actions'
import { createTemplate } from '@/lib/whatsapp/actions'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }

describe('payroll: approved unpaid leave is loss of pay', () => {
  const people = [{ id: 'p1', role: 'sales_advisor', is_active: true, base_salary: 52000 }, { id: 'p2', role: 'manager', is_active: true, base_salary: 52000 }]
  it('deducts only the days that fall inside the month, only for approved unpaid leave', async () => {
    resetWorld({
      profiles: people, payroll_runs: [], payroll_slips: [],
      leave_requests: [
        { user_id: 'p1', leave_type: 'unpaid', status: 'approved', from_date: '2026-10-05', to_date: '2026-10-06' },       // 2 days
        { user_id: 'p1', leave_type: 'unpaid', status: 'approved', from_date: '2026-09-29', to_date: '2026-10-02' },       // 2 days in October
        { user_id: 'p1', leave_type: 'casual', status: 'approved', from_date: '2026-10-10', to_date: '2026-10-12' },       // paid leave: no LOP
        { user_id: 'p1', leave_type: 'unpaid', status: 'pending', from_date: '2026-10-20', to_date: '2026-10-21' },        // not approved
        { user_id: 'p1', leave_type: 'unpaid', status: 'approved', from_date: '2026-11-03', to_date: '2026-11-04' },       // other month
      ],
    }, {}, 'admin', 'adm')
    await createPayrollRun(fd({ year: '2026', month: '10' }))
    const s1 = world.db.rows('payroll_slips').find((s) => s.user_id === 'p1')!
    const s2 = world.db.rows('payroll_slips').find((s) => s.user_id === 'p2')!
    // October 2026 has 27 working days; the four unpaid days are all weekdays.
    expect(s1).toMatchObject({ lop_days: 4, present_days: 23, working_days: 27 })
    expect(s2).toMatchObject({ lop_days: 0, present_days: 27 })
    expect(s2.net_pay - s1.net_pay).toBe(52000 - Math.round((52000 * 23) / 27)) // PF is capped, so only pay differs
    expect(world.db.rows('payroll_runs')[0].total_net).toBe(s1.net_pay + s2.net_pay)
  })
})

describe('marketing headline numbers use the same basis as the tables', () => {
  // The aggregation itself is SQL (marketing_headline, see tests/sql/04_campaigns.sql);
  // this checks the date range is passed through and the derived ratios.
  it('passes the date range to SQL and derives ROAS and CPL from paid numbers', async () => {
    const seen: any[] = []
    resetWorld({}, { rpc: { marketing_headline: (a: any) => { seen.push(a); return { total_spend: '100000', active_campaigns: 2, paid_leads: 4, paid_site_visits: 2, paid_bookings: 1, paid_revenue: '2000000' } } } }, 'admin')
    const s = await getMarketingStats({ from: '2026-10-01', to: '2026-10-20' })
    expect(seen[0]).toEqual({ p_from: '2026-10-01', p_to: '2026-10-20' })
    expect(s).toMatchObject({ totalSpend: 100000, totalRevenue: 2000000, totalBookings: 1, paidLeads: 4, paidSiteVisits: 2, overallROAS: 20, overallCPL: 25000 })
    await getMarketingStats()
    expect(seen[1]).toEqual({ p_from: null, p_to: null })
  })
})

describe('campaign actions', () => {
  it('rejects an end date before the start date and a negative budget', async () => {
    resetWorld({ marketing_campaigns: [] }, {}, 'manager')
    expect((await createCampaign(fd({ name: 'A', platform: 'facebook', start_date: '2026-10-10', end_date: '2026-10-01' }))).error).toMatch(/before the start/)
    expect((await createCampaign(fd({ name: 'A', platform: 'facebook', start_date: '2026-10-10', budget: '-1' }))).error).toMatch(/Budget/)
    expect((await createCampaign(fd({ name: 'A', platform: 'tiktok', start_date: '2026-10-10' }))).error).toMatch(/platform/)
    expect(world.db.rows('marketing_campaigns')).toHaveLength(0)
  })
  it('sales staff cannot manage campaigns', async () => {
    resetWorld({ marketing_campaigns: [] }, {}, 'sales_advisor')
    expect((await createCampaign(fd({ name: 'A', platform: 'facebook', start_date: '2026-10-10' }))).success).toBe(false)
  })
  it('a campaign can be edited, and utm_source is stored lower-case', async () => {
    resetWorld({ marketing_campaigns: [{ id: 'c1', name: 'Old', platform: 'facebook', start_date: '2026-10-01' }] }, {}, 'manager')
    const r = await updateCampaign('c1', fd({ name: 'New', platform: 'instagram', start_date: '2026-10-01', utm_source: ' Instagram ', utm_campaign: 'diwali' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('marketing_campaigns')[0]).toMatchObject({ name: 'New', platform: 'instagram', utm_source: 'instagram', utm_campaign: 'diwali' })
    expect((await updateCampaign('missing', fd({ name: 'X', platform: 'facebook', start_date: '2026-10-01' }))).error).toMatch(/not found/)
  })
  it('logging a day twice replaces that day instead of adding to it, and never writes campaign spend itself', async () => {
    resetWorld({ marketing_campaigns: [{ id: 'c1', spend: 142800 }], campaign_spend_logs: [{ id: 'o', campaign_id: 'c1', log_date: '2026-01-01', spend: 142800, kind: 'opening' }] }, {}, 'manager')
    const first = await logCampaignSpend(fd({ campaign_id: 'c1', log_date: '2026-10-19', spend: '5000' }))
    const again = await logCampaignSpend(fd({ campaign_id: 'c1', log_date: '2026-10-19', spend: '7000', reach: '900' }))
    expect(first).toMatchObject({ success: true, replaced: false })
    expect(again).toMatchObject({ success: true, replaced: true })
    const daily = world.db.rows('campaign_spend_logs').filter((l) => l.kind === 'daily')
    expect(daily).toHaveLength(1)
    expect(daily[0]).toMatchObject({ spend: 7000, reach: 900 })
    // The total is the DB trigger's job (sync_campaign_spend); the action must not overwrite it.
    expect(world.db.rows('marketing_campaigns')[0].spend).toBe(142800)
  })
  it('an unknown status is refused', async () => {
    resetWorld({ marketing_campaigns: [{ id: 'c1', status: 'active' }] }, {}, 'manager')
    expect((await updateCampaignStatus('c1', 'deleted')).success).toBe(false)
    expect((await updateCampaignStatus('c1', 'paused')).success).toBe(true)
    expect(world.db.rows('marketing_campaigns')[0].status).toBe('paused')
  })
})

describe('duplicate names are refused with a clear message', () => {
  it('a campaign cannot reuse a UTM campaign tag', async () => {
    resetWorld({ marketing_campaigns: [] }, { beforeWrite: (t, op, rows, db) => (t === 'marketing_campaigns' && op === 'insert' && db.rows('marketing_campaigns').some((c: any) => c.utm_campaign === rows[0].utm_campaign) ? { message: 'duplicate key', code: '23505' } : null) }, 'manager')
    expect((await createCampaign(fd({ name: 'A', platform: 'facebook', utm_campaign: 'diwali', start_date: '2026-10-01' }))).success).toBe(true)
    const r: any = await createCampaign(fd({ name: 'B', platform: 'google', utm_campaign: 'diwali', start_date: '2026-10-01' }))
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/already uses that UTM/)
  })
  it('a template cannot reuse a name in the same language', async () => {
    resetWorld({ whatsapp_templates: [] }, { beforeWrite: (t, op, rows, db) => (t === 'whatsapp_templates' && op === 'insert' && db.rows('whatsapp_templates').some((x: any) => x.name === rows[0].name && x.language === rows[0].language) ? { message: 'duplicate key', code: '23505' } : null) }, 'manager')
    const make = () => createTemplate(fd({ name: 'payment_reminder', display_name: 'Reminder', category: 'utility', language: 'en', body: 'Hi {{name}}' }))
    expect(((await make()) as any).success).toBe(true)
    const r: any = await make()
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/already exists/)
  })
})

describe('sign-out route (used to turn away deactivated accounts)', () => {
  it('signs out and returns to /login with the reason', async () => {
    resetWorld({}, {}, null)
    const { GET } = await import('@/app/api/auth/signout/route')
    const res = await GET(new NextRequest('http://localhost/api/auth/signout?reason=deactivated'))
    expect(world.db.signedOut).toBe(true)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?reason=deactivated')
  })
})
