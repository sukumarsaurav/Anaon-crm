'use server'

import { todayIST } from '@/lib/datetime'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { DEFAULT_PLOTTED_MILESTONES } from '@/types/construction'
import { fireAutomations } from '@/lib/automation/engine'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyUsers } from '@/lib/notifications/notify'
import { sendDemandEmail } from '@/lib/email/send'

/**
 * A completed payment-trigger milestone makes its share of the price due on every confirmed
 * construction-linked booking in the project: one installment per booking (due in 15 days), demand
 * letter emailed, advisor notified. System-generated, so it is written with the service role; the
 * payment guard keeps advisors from adding installments themselves. Idempotent per milestone.
 */
async function raiseMilestoneDemands(milestoneId: string, projectId: string) {
  const svc = createServiceClient()
  const { data: m } = await svc
    .from('construction_milestones').select('name, payment_percentage, is_payment_trigger').eq('id', milestoneId).single()
  if (!m?.is_payment_trigger || !(Number(m.payment_percentage) > 0)) return

  const { data: bookings } = await svc
    .from('bookings')
    .select('id, client_id, advisor_id, total_sale_value')
    .eq('project_id', projectId).eq('status', 'confirmed').eq('payment_plan_type', 'construction_linked')
  const description = `Milestone: ${m.name}`
  const due = new Date(Date.now() + 15 * 86_400_000)
  const dueDate = todayIST(due)

  for (const b of bookings ?? []) {
    const { data: existing } = await svc.from('payments').select('installment_number, description').eq('booking_id', b.id)
    if ((existing ?? []).some((p) => p.description === description)) continue
    const amount = Math.round(Number(b.total_sale_value ?? 0) * Number(m.payment_percentage) / 100)
    if (amount <= 0) continue
    const next = Math.max(0, ...(existing ?? []).map((p) => p.installment_number ?? 0)) + 1
    const { data: pay, error } = await svc.from('payments').insert({
      booking_id: b.id, client_id: b.client_id, installment_number: next, description,
      amount_due: amount, due_date: dueDate, status: 'pending',
    }).select('id').single()
    if (error || !pay) { console.error('[construction] demand installment failed:', error?.message); continue }
    await sendDemandEmail(pay.id)
    if (b.advisor_id) {
      await notifyUsers([b.advisor_id], {
        title: 'Construction payment due', message: `${m.name} is complete — a demand for ${amount.toLocaleString('en-IN')} was raised.`,
        type: 'payment_due', related_type: 'booking', related_id: b.id, action_url: `/bookings/${b.id}`,
      })
    }
  }
}

async function getAuthUser() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return null
  const profile = (await getProfile())?.profile
  if (!['admin', 'manager', 'sales_advisor'].includes(profile?.role ?? '')) return null
  return { supabase, user, isManager: ['admin', 'manager'].includes(profile?.role ?? '') }
}

export async function createMilestone(projectId: string, formData: FormData) {
  const auth = await getAuthUser()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase, user } = auth

  const { data: existing } = await supabase
    .from('construction_milestones')
    .select('sequence_order')
    .eq('project_id', projectId)
    .order('sequence_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (existing?.sequence_order ?? 0) + 1

  const { error } = await supabase.from('construction_milestones').insert({
    project_id:         projectId,
    name:               formData.get('name') as string,
    description:        formData.get('description') as string || null,
    payment_percentage: parseFloat(formData.get('payment_percentage') as string) || 0,
    sequence_order:     nextOrder,
    expected_date:      formData.get('expected_date') as string || null,
    is_payment_trigger: formData.get('is_payment_trigger') === 'true',
    status:             'pending',
    updated_by:         user.id,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  return { success: true }
}

export async function bulkCreateMilestones(projectId: string) {
  const auth = await getAuthUser()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase, user } = auth

  const { count } = await supabase
    .from('construction_milestones')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if ((count ?? 0) > 0) return { success: false, error: 'Milestones already exist for this project.' }

  const rows = DEFAULT_PLOTTED_MILESTONES.map((m) => ({
    ...m,
    project_id:         projectId,
    is_payment_trigger: m.payment_percentage > 0,
    status:             'pending',
    completion_percentage: 0,
    updated_by:         user.id,
  }))

  const { error } = await supabase.from('construction_milestones').insert(rows)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  return { success: true }
}

export async function updateMilestoneProgress(milestoneId: string, projectId: string, formData: FormData) {
  const auth = await getAuthUser()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase, user } = auth

  const completionPct = parseInt(formData.get('completion_percentage') as string, 10)
  const status        = formData.get('status') as string
  const photos        = formData.getAll('photos') as string[]

  const updates: Record<string, unknown> = {
    completion_percentage: completionPct,
    status,
    notes:       formData.get('notes') as string || null,
    updated_by:  user.id,
    updated_at:  new Date().toISOString(),
  }

  if (photos.length > 0) {
    const { data: current } = await supabase
      .from('construction_milestones')
      .select('photos')
      .eq('id', milestoneId)
      .single()
    const existing = (current?.photos as string[]) ?? []
    updates.photos = [...existing, ...photos.filter(Boolean)]
  }

  if (status === 'completed' && completionPct === 100) {
    updates.actual_completion_date = formData.get('completion_date') as string || todayIST()
    updates.completed_by = user.id
  }

  const { data: milestone } = await supabase
    .from('construction_milestones')
    .select('name, status')
    .eq('id', milestoneId)
    .single()

  const { error } = await supabase
    .from('construction_milestones')
    .update(updates)
    .eq('id', milestoneId)

  if (error) return { success: false, error: error.message }

  if (status === 'completed' && milestone?.status !== 'completed') {
    await raiseMilestoneDemands(milestoneId, projectId)
    // The automation messages clients, but the context carried none (and an empty project name),
    // so every milestone WhatsApp failed with "No phone number". Fan out to each booked client.
    const { data: proj } = await supabase.from('projects').select('name').eq('id', projectId).single()
    const { data: booked } = await supabase
      .from('bookings')
      .select('id, client:clients!bookings_client_id_fkey(id, full_name, phone)')
      .eq('project_id', projectId)
      .eq('status', 'confirmed')
      .limit(500)
    for (const b of booked ?? []) {
      const client = (Array.isArray(b.client) ? b.client[0] : b.client) as { id: string; full_name: string; phone: string } | null
      if (!client) continue
      fireAutomations('milestone_completed', {
        milestone: { id: milestoneId, name: milestone?.name ?? '', project_id: projectId },
        project: { id: projectId, name: proj?.name ?? '' },
        client,
      }, 'client', client.id)
    }
  }

  revalidatePath(`/inventory/${projectId}/construction`)
  revalidatePath('/construction')
  return { success: true }
}

export async function logMilestoneDelay(milestoneId: string, projectId: string, formData: FormData) {
  const auth = await getAuthUser()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase, user } = auth

  const { error } = await supabase
    .from('construction_milestones')
    .update({
      status:               'delayed',
      delay_reason:         formData.get('delay_reason') as string,
      revised_expected_date: formData.get('revised_expected_date') as string || null,
      delay_noted_by:       user.id,
      delay_noted_at:       new Date().toISOString(),
      updated_by:           user.id,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', milestoneId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  revalidatePath('/construction')
  return { success: true }
}

export async function deleteMilestone(milestoneId: string, projectId: string) {
  const auth = await getAuthUser()
  if (!auth) return { success: false, error: 'Unauthorized' }
  // Deleting a milestone removes construction history clients have been told about.
  if (!auth.isManager) return { success: false, error: 'Only managers can delete a milestone' }
  const { supabase } = auth

  const { error } = await supabase
    .from('construction_milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  return { success: true }
}
