'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Project, Plot, PlotHoldLog, PremiumMatrix,
  ProjectDocument, PriceEscalation, ProjectStats, CostSheet,
} from '@/types/inventory'

// ── Projects ─────────────────────────────────────────────────

export async function getProjects(filters: {
  status?: string
  type?: string
  city?: string
  search?: string
  activeOnly?: boolean
} = {}): Promise<Project[]> {
  const supabase = await createClient()
  let query = supabase
    .from('projects')
    .select('*, project_manager:profiles!projects_project_manager_id_fkey(id, full_name), branch:branches(id, name)')
    .order('created_at', { ascending: false })

  if (filters.activeOnly !== false) query = query.eq('is_active', true)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.type)   query = query.eq('type', filters.type)
  if (filters.city)   query = query.ilike('city', `%${filters.city}%`)
  if (filters.search) query = query.ilike('name', `%${filters.search}%`)

  const { data } = await query
  return (data ?? []) as Project[]
}

export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('*, project_manager:profiles!projects_project_manager_id_fkey(id, full_name), branch:branches(id, name)')
    .eq('id', id)
    .single()
  return data as Project | null
}

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plots')
    .select('status, total_price')
    .eq('project_id', projectId)

  const plots = data ?? []
  const sum = (statuses: string[]) =>
    plots.filter((p) => statuses.includes(p.status)).reduce((acc, p) => acc + (p.total_price ?? 0), 0)

  return {
    total:        plots.length,
    available:    plots.filter((p) => p.status === 'available').length,
    soft_hold:    plots.filter((p) => p.status === 'soft_hold').length,
    booked:       plots.filter((p) => p.status === 'booked').length,
    registered:   plots.filter((p) => p.status === 'registered').length,
    sold:         plots.filter((p) => p.status === 'sold').length,
    not_for_sale: plots.filter((p) => p.status === 'not_for_sale').length,
    revenue_potential: sum(['available']),
    revenue_booked:    sum(['booked', 'registered', 'sold']),
  }
}

// ── Plots ────────────────────────────────────────────────────

export async function getPlots(
  projectId: string,
  filters: { status?: string } = {}
): Promise<Plot[]> {
  const supabase = await createClient()
  let query = supabase
    .from('plots')
    .select(`
      *,
      held_by_profile:profiles!plots_held_by_fkey(id, full_name),
      booked_by_client:clients!plots_booked_by_client_id_fkey(id, full_name)
    `)
    .eq('project_id', projectId)

  if (filters.status) query = query.eq('status', filters.status)

  const { data } = await query.order('plot_number')
  return (data ?? []) as Plot[]
}

export async function getPlotById(id: string): Promise<Plot | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plots')
    .select(`
      *,
      held_by_profile:profiles!plots_held_by_fkey(id, full_name),
      booked_by_client:clients!plots_booked_by_client_id_fkey(id, full_name)
    `)
    .eq('id', id)
    .single()
  return data as Plot | null
}

export async function getPlotHoldsLog(plotId: string): Promise<PlotHoldLog[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plot_holds_log')
    .select('*, held_by_profile:profiles!plot_holds_log_held_by_fkey(id, full_name)')
    .eq('plot_id', plotId)
    .order('held_at', { ascending: false })
  return (data ?? []) as PlotHoldLog[]
}

export async function getPremiumMatrix(projectId: string): Promise<PremiumMatrix[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('premium_matrix')
    .select('*')
    .eq('project_id', projectId)
    .order('premium_type')
  return (data ?? []) as PremiumMatrix[]
}

// ── Documents ────────────────────────────────────────────────

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  let query = supabase
    .from('project_documents')
    .select('*, uploader:profiles!project_documents_uploaded_by_fkey(id, full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  // Non-admin only sees public docs
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    query = query.eq('is_public', true)
  }

  const { data } = await query
  return (data ?? []) as ProjectDocument[]
}

// ── Price escalations ────────────────────────────────────────

export async function getPriceEscalations(projectId: string): Promise<PriceEscalation[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('price_escalations')
    .select('*')
    .eq('project_id', projectId)
    .order('escalation_date', { ascending: false })
  return (data ?? []) as PriceEscalation[]
}

// ── Cost sheet ───────────────────────────────────────────────

export async function getCostSheet(plotId: string): Promise<CostSheet | null> {
  const plot = await getPlotById(plotId)
  if (!plot) return null

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', plot.project_id)
    .single()
  if (!project) return null

  const base_price   = plot.base_price
  const premiums: Array<{ label: string; amount: number }> = []

  if (plot.corner_premium > 0) premiums.push({ label: 'Corner Premium', amount: plot.corner_premium })
  if (plot.facing_premium > 0) premiums.push({ label: 'Facing Premium', amount: plot.facing_premium })
  if (plot.other_premium  > 0) premiums.push({ label: 'Other Premium',  amount: plot.other_premium })

  const total_premium     = premiums.reduce((s, p) => s + p.amount, 0)
  const development_charges = plot.development_charges ?? 0
  const sub_total         = base_price + total_premium + development_charges

  // Registration: 6% of sub_total for plots, 7% for apartments
  const reg_pct = project.type === 'apartment' ? 0.07 : 0.06
  const registration_charges = Math.round(sub_total * reg_pct)

  // GST: 5% on construction component for apartments, 0 for plotted
  const gst = project.type === 'apartment' ? Math.round(sub_total * 0.05) : 0

  const total_payable = sub_total + registration_charges + gst

  return {
    plot,
    project: project as Project,
    base_price,
    premiums,
    total_premium,
    development_charges,
    sub_total,
    registration_charges,
    gst,
    total_payable,
    generated_at: new Date().toISOString(),
  }
}

// ── Advisor hold count ────────────────────────────────────────

export async function getAdvisorActiveHolds(userId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('plots')
    .select('id', { count: 'exact', head: true })
    .eq('held_by', userId)
    .eq('status', 'soft_hold')
  return count ?? 0
}
