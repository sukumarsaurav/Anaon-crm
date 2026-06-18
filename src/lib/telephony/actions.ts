'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { initiateCall, exotelConfigured } from './exotel'

/**
 * Click-to-call: rings the logged-in agent, then connects to the lead.
 * Logs a pending `call` activity that the Exotel webhook later completes with
 * duration + recording URL.
 */
export async function initiateLeadCall(leadId: string): Promise<{ success: boolean; error?: string }> {
  if (!exotelConfigured()) return { success: false, error: 'Calling is not configured. Add Exotel credentials.' }

  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: me } = await supabase.from('profiles').select('phone').eq('id', user.id).single()
  if (!me?.phone) return { success: false, error: 'Your profile has no phone number to call from.' }

  const { data: lead } = await supabase.from('leads').select('phone').eq('id', leadId).single()
  if (!lead?.phone) return { success: false, error: 'Lead has no phone number' }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const statusCallback = base ? `${base}/api/webhooks/exotel` : undefined

  const result = await initiateCall(me.phone, lead.phone, statusCallback)
  if (!result.success) return { success: false, error: result.error }

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'call',
    notes: 'Outbound call initiated (click-to-call)',
    call_sid: result.callSid ?? null,
    performed_by: user.id,
  })

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}
