'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

async function getAuthUser() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { ok: false as const, error: 'Unauthorized', supabase, userId: '', role: '' }
  const profile = (await getProfile())?.profile
  return { ok: true as const, supabase, userId: user.id, role: profile?.role ?? '' }
}

// ── Projects ─────────────────────────────────────────────────

export async function createProject(formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const amenitiesRaw = formData.get('amenities') as string
  const amenities = amenitiesRaw ? amenitiesRaw.split('\n').map((a) => a.trim()).filter(Boolean) : []

  const { data, error } = await auth.supabase.from('projects').insert({
    name:                     formData.get('name') as string,
    type:                     formData.get('type') as string,
    city:                     formData.get('city') as string,
    locality:                 formData.get('locality') as string || null,
    address:                  formData.get('address') as string || null,
    google_maps_pin:          formData.get('google_maps_pin') as string || null,
    rera_number:              formData.get('rera_number') as string || null,
    status:                   (formData.get('status') as string) || 'pre_launch',
    launch_date:              formData.get('launch_date') as string || null,
    expected_completion_date: formData.get('expected_completion_date') as string || null,
    description:              formData.get('description') as string || null,
    total_units:              parseInt(formData.get('total_units') as string) || null,
    legal_contact:            formData.get('legal_contact') as string || null,
    contractor_name:          formData.get('contractor_name') as string || null,
    hold_duration_hours:      parseInt(formData.get('hold_duration_hours') as string) || 48,
    max_holds_per_advisor:    parseInt(formData.get('max_holds_per_advisor') as string) || 3,
    brochure_url:             formData.get('brochure_url') as string || null,
    price_list_url:           formData.get('price_list_url') as string || null,
    video_url:                formData.get('video_url') as string || null,
    virtual_tour_url:         formData.get('virtual_tour_url') as string || null,
    amenities,
    gallery_urls:             [],
    is_active:                true,
    created_by:               auth.userId,
  }).select('id').single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed' }
  revalidatePath('/inventory')
  return { success: true, id: data.id }
}

export async function updateProject(id: string, formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const amenitiesRaw = formData.get('amenities') as string
  const amenities = amenitiesRaw ? amenitiesRaw.split('\n').map((a) => a.trim()).filter(Boolean) : []

  const { error } = await auth.supabase.from('projects').update({
    name:                     formData.get('name') as string,
    type:                     formData.get('type') as string,
    city:                     formData.get('city') as string,
    locality:                 formData.get('locality') as string || null,
    address:                  formData.get('address') as string || null,
    google_maps_pin:          formData.get('google_maps_pin') as string || null,
    rera_number:              formData.get('rera_number') as string || null,
    status:                   formData.get('status') as string,
    launch_date:              formData.get('launch_date') as string || null,
    expected_completion_date: formData.get('expected_completion_date') as string || null,
    description:              formData.get('description') as string || null,
    total_units:              parseInt(formData.get('total_units') as string) || null,
    legal_contact:            formData.get('legal_contact') as string || null,
    contractor_name:          formData.get('contractor_name') as string || null,
    hold_duration_hours:      parseInt(formData.get('hold_duration_hours') as string) || 48,
    max_holds_per_advisor:    parseInt(formData.get('max_holds_per_advisor') as string) || 3,
    brochure_url:             formData.get('brochure_url') as string || null,
    price_list_url:           formData.get('price_list_url') as string || null,
    video_url:                formData.get('video_url') as string || null,
    virtual_tour_url:         formData.get('virtual_tour_url') as string || null,
    amenities,
    updated_at:               new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/inventory')
  revalidatePath(`/inventory/${id}`)
  return { success: true }
}

// ── Plots ─────────────────────────────────────────────────────

function computeTotalPrice(f: FormData): number {
  const base    = parseFloat(f.get('base_price') as string) || 0
  const corner  = parseFloat(f.get('corner_premium') as string) || 0
  const facing  = parseFloat(f.get('facing_premium') as string) || 0
  const other   = parseFloat(f.get('other_premium') as string) || 0
  const dev     = parseFloat(f.get('development_charges') as string) || 0
  return base + corner + facing + other + dev
}

export async function createPlot(formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('plots').insert({
    project_id:          formData.get('project_id') as string,
    plot_number:         formData.get('plot_number') as string,
    size_sqyd:           parseFloat(formData.get('size_sqyd') as string) || null,
    size_sqft:           parseFloat(formData.get('size_sqft') as string) || null,
    type:                (formData.get('type') as string) || 'regular',
    facing:              formData.get('facing') as string || null,
    floor_number:        parseInt(formData.get('floor_number') as string) || null,
    configuration:       formData.get('configuration') as string || null,
    base_price:          parseFloat(formData.get('base_price') as string) || 0,
    base_price_per_sqyd: parseFloat(formData.get('base_price_per_sqyd') as string) || null,
    corner_premium:      parseFloat(formData.get('corner_premium') as string) || 0,
    facing_premium:      parseFloat(formData.get('facing_premium') as string) || 0,
    other_premium:       parseFloat(formData.get('other_premium') as string) || 0,
    development_charges: parseFloat(formData.get('development_charges') as string) || 0,
    total_price:         computeTotalPrice(formData),
    status:              'available',
    notes:               formData.get('notes') as string || null,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${formData.get('project_id')}`)
  return { success: true }
}

export async function createBulkPlots(formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const projectId  = formData.get('project_id') as string
  const prefix     = formData.get('prefix') as string        // e.g. "A-"
  const fromNum    = parseInt(formData.get('from_number') as string)
  const toNum      = parseInt(formData.get('to_number') as string)
  const base_price = parseFloat(formData.get('base_price') as string) || 0
  const size_sqyd  = parseFloat(formData.get('size_sqyd') as string) || null
  const size_sqft  = parseFloat(formData.get('size_sqft') as string) || null
  const dev_charges = parseFloat(formData.get('development_charges') as string) || 0

  if (isNaN(fromNum) || isNaN(toNum) || toNum < fromNum) {
    return { success: false, error: 'Invalid number range' }
  }
  if (toNum - fromNum > 499) return { success: false, error: 'Maximum 500 plots per batch' }

  const rows = Array.from({ length: toNum - fromNum + 1 }, (_, i) => ({
    project_id:          projectId,
    plot_number:         `${prefix}${fromNum + i}`,
    size_sqyd,
    size_sqft,
    type:                'regular' as const,
    base_price,
    development_charges: dev_charges,
    total_price:         base_price + dev_charges,
    status:              'available' as const,
  }))

  const { error } = await auth.supabase.from('plots').insert(rows)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${projectId}`)
  return { success: true, count: rows.length }
}

export async function updatePlot(id: string, formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const { data: plot } = await auth.supabase.from('plots').select('project_id').eq('id', id).single()

  const { error } = await auth.supabase.from('plots').update({
    plot_number:         formData.get('plot_number') as string,
    size_sqyd:           parseFloat(formData.get('size_sqyd') as string) || null,
    size_sqft:           parseFloat(formData.get('size_sqft') as string) || null,
    type:                formData.get('type') as string,
    facing:              formData.get('facing') as string || null,
    floor_number:        parseInt(formData.get('floor_number') as string) || null,
    configuration:       formData.get('configuration') as string || null,
    base_price:          parseFloat(formData.get('base_price') as string) || 0,
    base_price_per_sqyd: parseFloat(formData.get('base_price_per_sqyd') as string) || null,
    corner_premium:      parseFloat(formData.get('corner_premium') as string) || 0,
    facing_premium:      parseFloat(formData.get('facing_premium') as string) || 0,
    other_premium:       parseFloat(formData.get('other_premium') as string) || 0,
    development_charges: parseFloat(formData.get('development_charges') as string) || 0,
    total_price:         computeTotalPrice(formData),
    notes:               formData.get('notes') as string || null,
    status:              formData.get('status') as string,
    updated_at:          new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  if (plot?.project_id) revalidatePath(`/inventory/${plot.project_id}`)
  return { success: true }
}

// ── Soft hold ────────────────────────────────────────────────

export async function softHoldPlot(plotId: string, leadId?: string) {
  const auth = await getAuthUser()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  // Check plot is available
  const { data: plot } = await auth.supabase
    .from('plots')
    .select('status, project_id')
    .eq('id', plotId)
    .single()

  if (!plot) return { success: false, error: 'Plot not found' }
  if (plot.status !== 'available') return { success: false, error: 'Plot is not available' }

  // Fetch project hold config
  const { data: project } = await auth.supabase
    .from('projects')
    .select('hold_duration_hours, max_holds_per_advisor')
    .eq('id', plot.project_id)
    .single()

  // Check advisor's active hold count
  const { count: activeHolds } = await auth.supabase
    .from('plots')
    .select('id', { count: 'exact', head: true })
    .eq('held_by', auth.userId)
    .eq('status', 'soft_hold')

  const maxHolds = project?.max_holds_per_advisor ?? 3
  if ((activeHolds ?? 0) >= maxHolds) {
    return { success: false, error: `You can hold a maximum of ${maxHolds} plots at a time` }
  }

  const holdHours = project?.hold_duration_hours ?? 48
  const expiresAt = new Date(Date.now() + holdHours * 60 * 60 * 1000).toISOString()

  // Update plot
  const { error } = await auth.supabase.from('plots').update({
    status:     'soft_hold',
    held_by:    auth.userId,
    held_until: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', plotId)

  if (error) return { success: false, error: error.message }

  // Log the hold
  await auth.supabase.from('plot_holds_log').insert({
    plot_id:    plotId,
    project_id: plot.project_id,
    held_by:    auth.userId,
    expires_at: expiresAt,
    lead_id:    leadId ?? null,
  })

  revalidatePath(`/inventory/${plot.project_id}`)
  return { success: true, expires_at: expiresAt }
}

export async function releaseHold(plotId: string, outcome: 'released' | 'booked' = 'released') {
  const auth = await getAuthUser()
  if (!auth.ok) return { success: false, error: 'Unauthorized' }

  const { data: plot } = await auth.supabase
    .from('plots')
    .select('status, project_id, held_by')
    .eq('id', plotId)
    .single()

  if (!plot || plot.status !== 'soft_hold') return { success: false, error: 'Plot is not on hold' }

  // Only the holder or admin/manager can release
  if (plot.held_by !== auth.userId && !['admin', 'manager'].includes(auth.role)) {
    return { success: false, error: 'You cannot release this hold' }
  }

  const { error } = await auth.supabase.from('plots').update({
    status:     'available',
    held_by:    null,
    held_until: null,
    updated_at: new Date().toISOString(),
  }).eq('id', plotId)

  if (error) return { success: false, error: error.message }

  // Update hold log
  await auth.supabase.from('plot_holds_log').update({
    released_at: new Date().toISOString(),
    outcome,
  })
    .eq('plot_id', plotId)
    .is('released_at', null)

  revalidatePath(`/inventory/${plot.project_id}`)
  return { success: true }
}

// ── Documents ─────────────────────────────────────────────────

export async function addProjectDocument(formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('project_documents').insert({
    project_id:  formData.get('project_id') as string,
    name:        formData.get('name') as string,
    category:    formData.get('category') as string,
    file_url:    formData.get('file_url') as string,
    is_public:   formData.get('is_public') === 'true',
    uploaded_by: auth.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${formData.get('project_id')}`)
  return { success: true }
}

// ── Price escalation ──────────────────────────────────────────

export async function schedulePriceEscalation(formData: FormData) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  const { error } = await auth.supabase.from('price_escalations').insert({
    project_id:          formData.get('project_id') as string,
    escalation_date:     formData.get('escalation_date') as string,
    percentage_increase: parseFloat(formData.get('percentage_increase') as string),
    notes:               formData.get('notes') as string || null,
    applied:             false,
    created_by:          auth.userId,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/inventory/${formData.get('project_id')}`)
  return { success: true }
}

// ── Premium matrix ────────────────────────────────────────────

export async function savePremiumMatrix(projectId: string, premiums: Array<{ type: string; percent: number; label: string }>) {
  const auth = await getAuthUser()
  if (!auth.ok || !['admin', 'manager'].includes(auth.role)) return { success: false, error: 'Forbidden' }

  for (const p of premiums) {
    await auth.supabase.from('premium_matrix').upsert({
      project_id:   projectId,
      premium_type: p.type,
      percent:      p.percent,
      label:        p.label || null,
    }, { onConflict: 'project_id,premium_type' })
  }

  revalidatePath(`/inventory/${projectId}`)
  return { success: true }
}
