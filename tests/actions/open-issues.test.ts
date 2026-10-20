import { world, resetWorld } from '../helpers/world'
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { createPayrollRun } from '@/lib/hr/actions'
import { getMarketingStats } from '@/lib/marketing/queries'
import { createCampaign } from '@/lib/marketing/actions'
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
    expect(s1).toMatchObject({ lop_days: 4, present_days: 22 })
    expect(s2).toMatchObject({ lop_days: 0, present_days: 26 })
    expect(s2.net_pay - s1.net_pay).toBe(Math.round((52000 / 26) * 4)) // 8000
    expect(world.db.rows('payroll_runs')[0].total_net).toBe(s1.net_pay + s2.net_pay)
  })
})

describe('marketing headline numbers use the same basis as the tables', () => {
  it('only bookings from paid channels count toward revenue, bookings and ROAS', async () => {
    resetWorld({
      marketing_campaigns: [{ id: 'c', spend: 100000, status: 'active' }],
      leads: [{ id: 'L1', utm_source: 'facebook' }, { id: 'L2', utm_source: 'referral' }, { id: 'L3', utm_source: 'google' }],
      site_visits: [{ id: 'v' }],
      clients: [{ id: 'C1', lead_id: 'L1' }, { id: 'C2', lead_id: 'L2' }, { id: 'C3', lead_id: null }],
      bookings: [{ id: 'B1', client_id: 'C1', total_sale_value: 2000000, status: 'confirmed' }, { id: 'B2', client_id: 'C2', total_sale_value: 9000000, status: 'confirmed' }, { id: 'B3', client_id: 'C3', total_sale_value: 5000000, status: 'confirmed' }],
    }, {}, 'admin')
    const s = await getMarketingStats()
    expect(s).toMatchObject({ totalRevenue: 2000000, totalBookings: 1, paidLeads: 2, overallROAS: 20 })
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
