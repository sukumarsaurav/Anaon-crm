'use server'

import { createClient } from '@/lib/supabase/server'
import type { ConstructionMilestone, ConstructionDashboardData, ConstructionProjectSummary } from '@/types/construction'

const MILESTONE_SELECT = `
  *,
  completer:profiles!construction_milestones_completed_by_fkey(id, full_name),
  updater:profiles!construction_milestones_updated_by_fkey(id, full_name)
`

export async function getProjectMilestones(projectId: string): Promise<ConstructionMilestone[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('construction_milestones')
    .select(MILESTONE_SELECT)
    .eq('project_id', projectId)
    .order('sequence_order')
  return (data ?? []) as unknown as ConstructionMilestone[]
}

export async function getMilestoneById(id: string): Promise<ConstructionMilestone | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('construction_milestones')
    .select(MILESTONE_SELECT)
    .eq('id', id)
    .single()
  return data as unknown as ConstructionMilestone | null
}

export async function getConstructionDashboard(): Promise<ConstructionDashboardData> {
  const supabase = await createClient()

  const [{ data: projects }, { data: milestones }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, city, type, status')
      .eq('is_active', true)
      .in('status', ['under_construction', 'pre_launch', 'ready_to_move']),
    supabase
      .from('construction_milestones')
      .select(`*, project:projects!construction_milestones_project_id_fkey(id, name, city)`)
      .order('sequence_order'),
  ])

  const projectList = projects ?? []
  const allMilestones = (milestones ?? []) as unknown as Array<
    ConstructionMilestone & { project: { id: string; name: string; city: string } }
  >

  // Group milestones by project
  const byProject = new Map<string, typeof allMilestones>()
  for (const m of allMilestones) {
    if (!byProject.has(m.project_id)) byProject.set(m.project_id, [])
    byProject.get(m.project_id)!.push(m)
  }

  const projectSummaries: ConstructionProjectSummary[] = projectList.map((p) => {
    const ms = byProject.get(p.id) ?? []
    const completed = ms.filter((m) => m.status === 'completed')
    const delayed   = ms.filter((m) => m.status === 'delayed')
    const inProg    = ms.filter((m) => m.status === 'in_progress')

    const totalPct  = ms.reduce((s, m) => s + (m.payment_percentage ?? 0), 0)
    const donePct   = completed.reduce((s, m) => s + (m.payment_percentage ?? 0), 0)
    const overall   = totalPct > 0 ? Math.round((donePct / totalPct) * 100) : 0

    const pending   = ms.filter((m) => m.status !== 'completed').sort((a, b) => a.sequence_order - b.sequence_order)

    return {
      id: p.id,
      name: p.name,
      city: p.city,
      type: p.type,
      status: p.status,
      milestone_count: ms.length,
      completed_count: completed.length,
      delayed_count:   delayed.length,
      in_progress_count: inProg.length,
      overall_percentage: overall,
      current_milestone:  inProg[0] ?? pending[0] ?? null,
      next_milestone:     pending[1] ?? null,
    }
  })

  const delayedMilestones = allMilestones
    .filter((m) => m.status === 'delayed')
    .map((m) => ({ ...m, project_name: m.project?.name ?? '', project_city: m.project?.city ?? '' }))

  const recentCompletions = allMilestones
    .filter((m) => m.status === 'completed' && m.actual_completion_date)
    .sort((a, b) => (b.actual_completion_date ?? '').localeCompare(a.actual_completion_date ?? ''))
    .slice(0, 10)
    .map((m) => ({ ...m, project_name: m.project?.name ?? '', project_city: m.project?.city ?? '' }))

  return {
    projects: projectSummaries,
    total_delayed:     delayedMilestones.length,
    total_in_progress: allMilestones.filter((m) => m.status === 'in_progress').length,
    delayed_milestones: delayedMilestones,
    recent_completions: recentCompletions,
  }
}

export async function getConstructionLinkedBookings(projectId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_number, total_sale_value, payment_plan_type,
      client:clients!bookings_client_id_fkey(id, full_name, phone)
    `)
    .eq('project_id', projectId)
    .eq('status', 'confirmed')
    .eq('payment_plan_type', 'construction_linked')
  return (data ?? []) as unknown as Array<{
    id: string; booking_number: string; total_sale_value: number; payment_plan_type: string
    client: { id: string; full_name: string; phone: string }
  }>
}
