import { createClient } from '@/lib/supabase/server'
import type { MarketingCampaign, CampaignROI, SourceROI } from '@/types/marketing'

export async function getMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*, project:projects(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MarketingCampaign[]
}

export async function getCampaignById(id: string): Promise<MarketingCampaign | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketing_campaigns')
    .select('*, project:projects(name)')
    .eq('id', id)
    .single()
  return data as MarketingCampaign | null
}

// Source-level ROI: group by utm_source across all campaigns
export async function getSourceROI(
  fromDate?: string,
  toDate?: string,
): Promise<SourceROI[]> {
  const supabase = await createClient()

  // Build date filters
  const dateFilter = (col: string) => {
    const filters: string[] = []
    if (fromDate) filters.push(`${col}.gte.${fromDate}`)
    if (toDate) filters.push(`${col}.lte.${toDate}`)
    return filters
  }

  // Fetch leads grouped by utm_source
  let leadsQuery = supabase
    .from('leads')
    .select('utm_source, id')
    .not('utm_source', 'is', null)
  if (fromDate) leadsQuery = leadsQuery.gte('created_at', fromDate)
  if (toDate) leadsQuery = leadsQuery.lte('created_at', toDate)
  const { data: leads } = await leadsQuery

  // Fetch site visits with lead utm_source join
  let visitsQuery = supabase
    .from('site_visits')
    .select('id, lead_id, leads!inner(utm_source)')
  if (fromDate) visitsQuery = visitsQuery.gte('created_at', fromDate)
  if (toDate) visitsQuery = visitsQuery.lte('created_at', toDate)
  const { data: visits } = await visitsQuery

  // Fetch bookings with lead utm_source join (via client)
  let bookingsQuery = supabase
    .from('bookings')
    .select('id, total_sale_value, clients!inner(leads!inner(utm_source))')
    .eq('status', 'confirmed')
  if (fromDate) bookingsQuery = bookingsQuery.gte('booking_date', fromDate)
  if (toDate) bookingsQuery = bookingsQuery.lte('booking_date', toDate)
  const { data: bookings } = await bookingsQuery

  // Fetch spend per utm_source via campaigns
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('utm_source, spend')
    .not('utm_source', 'is', null)

  // Aggregate
  const sources = new Map<string, SourceROI>()

  const getOrCreate = (src: string) => {
    if (!sources.has(src)) {
      sources.set(src, {
        utm_source: src,
        leads_count: 0,
        site_visits_count: 0,
        bookings_count: 0,
        revenue: 0,
        spend: 0,
        cpl: null,
        roas: null,
        lead_to_visit_rate: 0,
        visit_to_booking_rate: 0,
      })
    }
    return sources.get(src)!
  }

  for (const lead of leads ?? []) {
    if (lead.utm_source) getOrCreate(lead.utm_source).leads_count++
  }

  for (const visit of visits ?? []) {
    const src = (visit as any).leads?.utm_source
    if (src) getOrCreate(src).site_visits_count++
  }

  for (const booking of bookings ?? []) {
    const src = (booking as any).clients?.leads?.utm_source
    if (src) {
      const row = getOrCreate(src)
      row.bookings_count++
      row.revenue += Number(booking.total_sale_value ?? 0)
    }
  }

  for (const c of campaigns ?? []) {
    if (c.utm_source) getOrCreate(c.utm_source).spend += Number(c.spend ?? 0)
  }

  // Calculate derived metrics
  for (const row of sources.values()) {
    row.cpl = row.spend > 0 && row.leads_count > 0 ? Math.round(row.spend / row.leads_count) : null
    row.roas = row.spend > 0 ? Math.round((row.revenue / row.spend) * 100) / 100 : null
    row.lead_to_visit_rate = row.leads_count > 0
      ? Math.round((row.site_visits_count / row.leads_count) * 1000) / 10
      : 0
    row.visit_to_booking_rate = row.site_visits_count > 0
      ? Math.round((row.bookings_count / row.site_visits_count) * 1000) / 10
      : 0
  }

  return Array.from(sources.values()).sort((a, b) => b.leads_count - a.leads_count)
}

// Campaign-level ROI: each campaign matched by utm_campaign
export async function getCampaignROI(fromDate?: string, toDate?: string): Promise<CampaignROI[]> {
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('id, name, platform, utm_source, utm_campaign, spend')
    .order('created_at', { ascending: false })

  let leadsQuery = supabase
    .from('leads')
    .select('utm_source, utm_campaign, id')
    .not('utm_campaign', 'is', null)
  if (fromDate) leadsQuery = leadsQuery.gte('created_at', fromDate)
  if (toDate) leadsQuery = leadsQuery.lte('created_at', toDate)
  const { data: leads } = await leadsQuery

  let visitsQuery = supabase
    .from('site_visits')
    .select('id, leads!inner(utm_campaign, utm_source)')
  if (fromDate) visitsQuery = visitsQuery.gte('created_at', fromDate)
  if (toDate) visitsQuery = visitsQuery.lte('created_at', toDate)
  const { data: visits } = await visitsQuery

  let bookingsQuery = supabase
    .from('bookings')
    .select('id, total_sale_value, clients!inner(leads!inner(utm_campaign, utm_source))')
    .eq('status', 'confirmed')
  if (fromDate) bookingsQuery = bookingsQuery.gte('booking_date', fromDate)
  if (toDate) bookingsQuery = bookingsQuery.lte('booking_date', toDate)
  const { data: bookings } = await bookingsQuery

  // Build a campaign map keyed by utm_campaign
  const campaignMap = new Map<string, CampaignROI>()

  for (const c of campaigns ?? []) {
    const key = c.utm_campaign ?? `campaign:${c.id}`
    if (!campaignMap.has(key)) {
      campaignMap.set(key, {
        utm_source: c.utm_source ?? '',
        utm_campaign: c.utm_campaign,
        platform: c.platform,
        campaign_id: c.id,
        campaign_name: c.name,
        leads_count: 0,
        site_visits_count: 0,
        bookings_count: 0,
        revenue: 0,
        spend: 0,
        cpl: null, cpv: null, cpb: null, roas: null,
        lead_to_visit_rate: 0,
        visit_to_booking_rate: 0,
      })
    }
    campaignMap.get(key)!.spend += Number(c.spend ?? 0)
  }

  // Also create rows for utm_campaigns not linked to a campaign record
  for (const lead of leads ?? []) {
    const key = lead.utm_campaign!
    if (!campaignMap.has(key)) {
      campaignMap.set(key, {
        utm_source: lead.utm_source ?? '',
        utm_campaign: key,
        platform: null,
        campaign_id: null,
        campaign_name: null,
        leads_count: 0,
        site_visits_count: 0,
        bookings_count: 0,
        revenue: 0,
        spend: 0,
        cpl: null, cpv: null, cpb: null, roas: null,
        lead_to_visit_rate: 0,
        visit_to_booking_rate: 0,
      })
    }
    campaignMap.get(key)!.leads_count++
  }

  for (const visit of visits ?? []) {
    const utm = (visit as any).leads?.utm_campaign
    if (utm && campaignMap.has(utm)) campaignMap.get(utm)!.site_visits_count++
  }

  for (const booking of bookings ?? []) {
    const utm = (booking as any).clients?.leads?.utm_campaign
    if (utm && campaignMap.has(utm)) {
      const row = campaignMap.get(utm)!
      row.bookings_count++
      row.revenue += Number(booking.total_sale_value ?? 0)
    }
  }

  for (const row of campaignMap.values()) {
    row.cpl = row.spend > 0 && row.leads_count > 0 ? Math.round(row.spend / row.leads_count) : null
    row.cpv = row.spend > 0 && row.site_visits_count > 0 ? Math.round(row.spend / row.site_visits_count) : null
    row.cpb = row.spend > 0 && row.bookings_count > 0 ? Math.round(row.spend / row.bookings_count) : null
    row.roas = row.spend > 0 ? Math.round((row.revenue / row.spend) * 100) / 100 : null
    row.lead_to_visit_rate = row.leads_count > 0
      ? Math.round((row.site_visits_count / row.leads_count) * 1000) / 10
      : 0
    row.visit_to_booking_rate = row.site_visits_count > 0
      ? Math.round((row.bookings_count / row.site_visits_count) * 1000) / 10
      : 0
  }

  return Array.from(campaignMap.values()).sort((a, b) => b.leads_count - a.leads_count)
}

export async function getMarketingStats() {
  const supabase = await createClient()
  const [campaigns, leads, visits, bookings] = await Promise.all([
    supabase.from('marketing_campaigns').select('id, spend, status'),
    supabase.from('leads').select('id, utm_source').not('utm_source', 'is', null),
    supabase.from('site_visits').select('id'),
    supabase.from('bookings').select('id, total_sale_value').eq('status', 'confirmed'),
  ])

  const totalSpend = (campaigns.data ?? []).reduce((s, c) => s + Number(c.spend ?? 0), 0)
  const activeCampaigns = (campaigns.data ?? []).filter(c => c.status === 'active').length
  const paidLeads = (leads.data ?? []).filter(l => ['facebook', 'instagram', 'google'].includes(l.utm_source ?? '')).length
  const totalRevenue = (bookings.data ?? []).reduce((s, b) => s + Number(b.total_sale_value ?? 0), 0)

  return {
    totalSpend,
    activeCampaigns,
    totalLeads: (leads.data ?? []).length,
    paidLeads,
    totalSiteVisits: (visits.data ?? []).length,
    totalBookings: (bookings.data ?? []).length,
    totalRevenue,
    overallROAS: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : null,
    overallCPL: totalSpend > 0 && paidLeads > 0 ? Math.round(totalSpend / paidLeads) : null,
  }
}
