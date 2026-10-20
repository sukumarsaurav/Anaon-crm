'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_PLATFORMS, CAMPAIGN_STATUSES } from '@/types/marketing'
import type { CampaignSpendLog } from '@/types/marketing'

type Result = { success: boolean; error?: string }

// Matches the RLS on marketing_campaigns / campaign_spend_logs (admin or manager).
async function getAuthUser() {
  const session = await getProfile()
  const user = session?.user
  if (!user) throw new Error('Unauthorized')
  if (!['admin', 'manager'].includes(session?.profile?.role ?? '')) {
    throw new Error('Only admins and managers can manage campaigns')
  }
  return user
}

const text = (formData: FormData, key: string) => ((formData.get(key) as string | null) ?? '').trim()
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Validates the campaign form. Spend is not here: it is the sum of the spend logs. */
function parseCampaign(formData: FormData): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const name = text(formData, 'name')
  const platform = text(formData, 'platform')
  const objective = text(formData, 'objective')
  const startDate = text(formData, 'start_date')
  const endDate = text(formData, 'end_date')
  const budgetRaw = text(formData, 'budget')
  const budget = budgetRaw ? Number(budgetRaw) : 0

  if (!name) return { ok: false, error: 'Campaign name is required' }
  if (!CAMPAIGN_PLATFORMS.some((p) => p.value === platform)) return { ok: false, error: 'Choose a platform' }
  if (objective && !CAMPAIGN_OBJECTIVES.some((o) => o.value === objective)) return { ok: false, error: 'Unknown objective' }
  if (!DATE.test(startDate)) return { ok: false, error: 'Start date is required' }
  if (endDate && !DATE.test(endDate)) return { ok: false, error: 'Invalid end date' }
  if (endDate && endDate < startDate) return { ok: false, error: 'End date cannot be before the start date' }
  if (!Number.isFinite(budget) || budget < 0) return { ok: false, error: 'Budget must be zero or more' }

  return {
    ok: true,
    values: {
      name,
      platform,
      objective: objective || null,
      // utm_source is compared with the normalised lead source, so keep it lower-case.
      utm_source: text(formData, 'utm_source').toLowerCase() || null,
      utm_medium: text(formData, 'utm_medium') || null,
      utm_campaign: text(formData, 'utm_campaign') || null,
      project_id: text(formData, 'project_id') || null,
      start_date: startDate,
      end_date: endDate || null,
      budget,
      meta_campaign_id: text(formData, 'meta_campaign_id') || null,
      meta_adset_id: text(formData, 'meta_adset_id') || null,
      notes: text(formData, 'notes') || null,
    },
  }
}

function campaignWriteError(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    return error.message.includes('meta_campaign_id')
      ? 'Another campaign already uses that Meta campaign ID.'
      : 'Another campaign already uses that UTM campaign tag (tags are case-insensitive) - each campaign needs its own, or their leads and spend merge in the reports.'
  }
  if (error.code === '23514') return 'Check the dates and budget: the end date cannot be before the start, and the budget cannot be negative.'
  return error.message
}

export async function createCampaign(formData: FormData): Promise<Result> {
  try {
    const user = await getAuthUser()
    const parsed = parseCampaign(formData)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const supabase = await createClient()
    const { error } = await supabase.from('marketing_campaigns').insert({ ...parsed.values, created_by: user.id })
    if (error) return { success: false, error: campaignWriteError(error) }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateCampaign(campaignId: string, formData: FormData): Promise<Result> {
  try {
    await getAuthUser()
    const parsed = parseCampaign(formData)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update({ ...parsed.values, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .select('id')
    if (error) return { success: false, error: campaignWriteError(error) }
    if (!data?.length) return { success: false, error: 'Campaign not found' }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Records one day's spend. A day that already has a log is replaced, not added to, so
 * re-entering a day can't double-count it. The campaign total is kept by a DB trigger.
 */
export async function logCampaignSpend(formData: FormData): Promise<Result & { replaced?: boolean }> {
  try {
    const user = await getAuthUser()
    const campaignId = text(formData, 'campaign_id')
    const logDate = text(formData, 'log_date')
    const spend = Number(text(formData, 'spend'))
    if (!campaignId) return { success: false, error: 'Missing campaign' }
    if (!DATE.test(logDate)) return { success: false, error: 'Choose a date' }
    if (!Number.isFinite(spend) || spend < 0) return { success: false, error: 'Spend must be zero or more' }

    const count = (key: string) => {
      const n = parseInt(text(formData, key), 10)
      return Number.isFinite(n) && n > 0 ? n : 0
    }
    const row = {
      spend,
      impressions: count('impressions'),
      clicks: count('clicks'),
      reach: count('reach'),
      notes: text(formData, 'notes') || null,
      logged_by: user.id,
    }

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('campaign_spend_logs')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('log_date', logDate)
      .eq('kind', 'daily')
      .maybeSingle()

    const { error } = existing
      ? await supabase.from('campaign_spend_logs').update(row).eq('id', existing.id)
      : await supabase.from('campaign_spend_logs').insert({ ...row, campaign_id: campaignId, log_date: logDate, kind: 'daily' })
    if (error?.code === '23505') return { success: false, error: 'That day was just logged by someone else - refresh and try again.' }
    if (error) return { success: false, error: error.message }

    revalidatePath('/marketing')
    return { success: true, replaced: Boolean(existing) }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getCampaignSpendLogs(campaignId: string): Promise<{ success: boolean; error?: string; logs?: CampaignSpendLog[] }> {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('campaign_spend_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('log_date', { ascending: false })
      .limit(366)
    if (error) return { success: false, error: error.message }
    return { success: true, logs: (data ?? []) as CampaignSpendLog[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteSpendLog(logId: string): Promise<Result> {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { data, error } = await supabase.from('campaign_spend_logs').delete().eq('id', logId).select('id')
    if (error) return { success: false, error: error.message }
    if (!data?.length) return { success: false, error: 'Spend entry not found' }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateCampaignStatus(campaignId: string, status: string): Promise<Result> {
  try {
    await getAuthUser()
    if (!CAMPAIGN_STATUSES.includes(status as never)) return { success: false, error: 'Unknown status' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .select('id')
    if (error) return { success: false, error: error.message }
    if (!data?.length) return { success: false, error: 'Campaign not found' }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteCampaign(campaignId: string): Promise<Result> {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', campaignId)
      .select('id')
    if (error) return { success: false, error: error.message }
    if (!data?.length) return { success: false, error: 'Campaign not found' }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
