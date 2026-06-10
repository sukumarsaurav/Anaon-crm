'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { DEFAULT_PLOTTED_MILESTONES } from '@/types/construction'
import { fireAutomations } from '@/lib/automation/engine'

async function getAuthUser() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return null
  const profile = (await getProfile())?.profile
  if (!['admin', 'manager', 'sales_advisor'].includes(profile?.role ?? '')) return null
  return { supabase, user }
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
    updates.actual_completion_date = formData.get('completion_date') as string || new Date().toISOString().split('T')[0]
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
    fireAutomations('milestone_completed', {
      milestone: { id: milestoneId, name: milestone?.name ?? '', project_id: projectId },
      project: { id: projectId, name: '' },
    }, 'milestone', milestoneId)
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
  const { supabase } = auth

  const { error } = await supabase
    .from('construction_milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}/construction`)
  return { success: true }
}
