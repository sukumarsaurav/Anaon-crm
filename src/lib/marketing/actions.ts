'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'manager', 'marketing'].includes(profile.role)) {
    throw new Error('Insufficient permissions')
  }
  return user
}

export async function createCampaign(formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const endDate = formData.get('end_date') as string
    const { error } = await supabase.from('marketing_campaigns').insert({
      name:             formData.get('name') as string,
      platform:         formData.get('platform') as string,
      utm_source:       (formData.get('utm_source') as string) || null,
      utm_medium:       (formData.get('utm_medium') as string) || null,
      utm_campaign:     (formData.get('utm_campaign') as string) || null,
      project_id:       (formData.get('project_id') as string) || null,
      start_date:       formData.get('start_date') as string,
      end_date:         endDate || null,
      budget:           parseFloat(formData.get('budget') as string) || 0,
      objective:        (formData.get('objective') as string) || null,
      meta_campaign_id: (formData.get('meta_campaign_id') as string) || null,
      meta_adset_id:    (formData.get('meta_adset_id') as string) || null,
      notes:            (formData.get('notes') as string) || null,
      created_by:       user.id,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateCampaignSpend(campaignId: string, formData: FormData) {
  try {
    await getAuthUser()
    const supabase = await createClient()

    const spend = parseFloat(formData.get('spend') as string)
    if (isNaN(spend)) return { success: false, error: 'Invalid spend amount' }

    const { error } = await supabase
      .from('marketing_campaigns')
      .update({ spend, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function logCampaignSpend(formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const campaignId = formData.get('campaign_id') as string
    const logDate = formData.get('log_date') as string
    const spend = parseFloat(formData.get('spend') as string) || 0

    const { error } = await supabase.from('campaign_spend_logs').insert({
      campaign_id:  campaignId,
      log_date:     logDate,
      spend,
      impressions:  parseInt(formData.get('impressions') as string) || 0,
      clicks:       parseInt(formData.get('clicks') as string) || 0,
      reach:        parseInt(formData.get('reach') as string) || 0,
      notes:        (formData.get('notes') as string) || null,
      logged_by:    user.id,
    })
    if (error) return { success: false, error: error.message }

    // Update total spend on campaign
    const { data: logs } = await supabase
      .from('campaign_spend_logs')
      .select('spend')
      .eq('campaign_id', campaignId)
    const totalSpend = (logs ?? []).reduce((s, l) => s + Number(l.spend), 0)
    await supabase
      .from('marketing_campaigns')
      .update({ spend: totalSpend, updated_at: new Date().toISOString() })
      .eq('id', campaignId)

    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateCampaignStatus(campaignId: string, status: string) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { error } = await supabase
      .from('marketing_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteCampaign(campaignId: string) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', campaignId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/marketing')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
