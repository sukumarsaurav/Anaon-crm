import { createClient } from '@/lib/supabase/server'
import type { MarketingCampaign, CampaignROI, CampaignStatus, SourceROI } from '@/types/marketing'

/**
 * Marketing ROI. The aggregation runs in SQL (marketing_roi_by_source / _by_campaign /
 * marketing_headline): pulling raw lead/visit/booking rows into JS was capped at PostgREST's
 * row limit and used a different "site visit" and "paid" definition in every table.
 *
 * Shared definitions (see the 20261022100000_campaign_fixes migration):
 *   - leads:        live, non-duplicate leads created in the window
 *   - site visits:  leads with at least one completed visit in the window
 *   - bookings:     confirmed bookings dated in the window, via client → lead
 *   - spend:        spend logs dated in the window (all-time = campaign.spend)
 * Dates are IST calendar days, inclusive; omit both for all time.
 */
export interface DateRange {
  from?: string
  to?: string
}

const rangeArgs = ({ from, to }: DateRange) => ({ p_from: from || null, p_to: to || null })

const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)
const perUnit = (spend: number, n: number) => (spend > 0 && n > 0 ? Math.round(spend / n) : null)
const roas = (revenue: number, spend: number) => (spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null)

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

export async function getSourceROI(range: DateRange = {}): Promise<SourceROI[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('marketing_roi_by_source', rangeArgs(range))
  if (error) throw error

  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const leads = Number(r.leads_count), visits = Number(r.site_visits_count)
      const bookings = Number(r.bookings_count), revenue = Number(r.revenue), spend = Number(r.spend)
      return {
        source: r.source_key as string,
        leads_count: leads,
        site_visits_count: visits,
        bookings_count: bookings,
        revenue,
        spend,
        cpl: perUnit(spend, leads),
        roas: roas(revenue, spend),
        lead_to_visit_rate: rate(visits, leads),
        visit_to_booking_rate: rate(bookings, visits),
      }
    })
    .sort((a, b) => b.leads_count - a.leads_count || b.spend - a.spend)
}

export async function getCampaignROI(range: DateRange = {}): Promise<CampaignROI[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('marketing_roi_by_campaign', rangeArgs(range))
  if (error) throw error

  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const leads = Number(r.leads_count), visits = Number(r.site_visits_count)
      const bookings = Number(r.bookings_count), revenue = Number(r.revenue), spend = Number(r.spend)
      return {
        utm_source: (r.utm_source as string | null) ?? '',
        utm_campaign: r.utm_campaign as string | null,
        platform: r.platform as string | null,
        campaign_id: r.campaign_id as string | null,
        campaign_name: r.campaign_name as string | null,
        status: r.status as CampaignStatus | null,
        leads_count: leads,
        site_visits_count: visits,
        bookings_count: bookings,
        revenue,
        spend,
        cpl: perUnit(spend, leads),
        cpv: perUnit(spend, visits),
        cpb: perUnit(spend, bookings),
        roas: roas(revenue, spend),
        lead_to_visit_rate: rate(visits, leads),
        visit_to_booking_rate: rate(bookings, visits),
      }
    })
    // Linked campaigns first, by activity; unlinked tags after them.
    .sort((a, b) =>
      Number(b.campaign_id !== null) - Number(a.campaign_id !== null)
      || b.leads_count - a.leads_count
      || b.spend - a.spend)
}

export async function getMarketingStats(range: DateRange = {}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('marketing_headline', rangeArgs(range))
  if (error) throw error
  // A set-returning function: always exactly one row.
  const h = ((Array.isArray(data) ? data[0] : data) ?? {}) as Record<string, unknown>

  const totalSpend = Number(h.total_spend)
  const paidLeads = Number(h.paid_leads)
  const totalRevenue = Number(h.paid_revenue)
  return {
    totalSpend,
    activeCampaigns: Number(h.active_campaigns),
    paidLeads,
    paidSiteVisits: Number(h.paid_site_visits),
    totalBookings: Number(h.paid_bookings),
    totalRevenue,
    overallROAS: roas(totalRevenue, totalSpend),
    overallCPL: perUnit(totalSpend, paidLeads),
  }
}
