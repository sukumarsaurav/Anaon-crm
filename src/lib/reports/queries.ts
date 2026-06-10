import { createClient } from '@/lib/supabase/server'

// ── helpers ───────────────────────────────────────────────────────────────────
function monthBounds(offset = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const start = d.toISOString().split('T')[0]
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    ;(acc[k] ??= []).push(item)
    return acc
  }, {} as Record<string, T[]>)
}

// ── Executive Dashboard ───────────────────────────────────────────────────────

export async function getExecDashboard() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_exec_dashboard')
  
  if (!data) {
    return {
      leads: { curr: 0, prev: 0, trend: null },
      visits: { curr: 0, prev: 0, trend: null },
      bookings: { curr: 0, prev: 0, trend: null },
      revenue: { curr: 0, prev: 0, trend: null },
      collections: 0,
      outstanding: 0,
      leadToVisitRate: 0,
      visitToBookingRate: 0,
    }
  }

  const pct = (a: number, b: number) => b === 0 ? null : Math.round(((a - b) / b) * 100)

  return {
    leads:       { curr: data.currLeads,    prev: data.prevLeads,    trend: pct(data.currLeads, data.prevLeads) },
    visits:      { curr: data.currVisits,   prev: data.prevVisits,   trend: pct(data.currVisits, data.prevVisits) },
    bookings:    { curr: data.currBookings, prev: data.prevBookings, trend: pct(data.currBookings, data.prevBookings) },
    revenue:     { curr: data.currRevenue,  prev: data.prevRevenue,  trend: pct(data.currRevenue, data.prevRevenue) },
    collections: data.currCollections,
    outstanding: data.outstanding,
    leadToVisitRate: data.currLeads > 0 ? Math.round((data.currVisits / data.currLeads) * 100) : 0,
    visitToBookingRate: data.currVisits > 0 ? Math.round((data.currBookings / data.currVisits) * 100) : 0,
  }
}

export async function getDailyLeadTrend(days = 30) {
  const supabase = await createClient()
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data } = await supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', from)
    .eq('is_active', true)

  const counts: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    counts[d] = 0
  }
  for (const r of data ?? []) {
    const d = r.created_at.split('T')[0]
    if (d in counts) counts[d]++
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

export async function getLeadsBySource() {
  const supabase = await createClient()
  const { data } = await supabase.from('leads').select('source, utm_source').eq('is_active', true)
  const counts: Record<string, number> = {}
  for (const r of data ?? []) {
    const key = r.utm_source || r.source || 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export async function getBookingsByProject() {
  const supabase = await createClient()
  const [bookingsRes, projectsRes] = await Promise.all([
    supabase.from('bookings').select('project_id, total_sale_value').eq('status', 'confirmed'),
    supabase.from('projects').select('id, name'),
  ])
  const projects = Object.fromEntries((projectsRes.data ?? []).map(p => [p.id, p.name]))
  const agg: Record<string, { count: number; revenue: number }> = {}
  for (const b of bookingsRes.data ?? []) {
    if (!b.project_id) continue
    agg[b.project_id] ??= { count: 0, revenue: 0 }
    agg[b.project_id].count++
    agg[b.project_id].revenue += Number(b.total_sale_value ?? 0)
  }
  return Object.entries(agg)
    .map(([pid, d]) => ({ project: projects[pid] ?? 'Unknown', count: d.count, revenue: d.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getMonthlyRevenueTrend(months = 12) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select('booking_date, total_sale_value')
    .eq('status', 'confirmed')
    .not('booking_date', 'is', null)

  const result: Record<string, number> = {}
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    result[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }
  for (const b of data ?? []) {
    const key = b.booking_date.slice(0, 7)
    if (key in result) result[key] += Number(b.total_sale_value ?? 0)
  }
  return Object.entries(result).map(([month, revenue]) => ({ month, revenue }))
}

// ── Lead Reports ──────────────────────────────────────────────────────────────

export async function getLeadFunnel() {
  const supabase = await createClient()
  const { data } = await supabase.from('leads').select('stage').eq('is_active', true)
  const stages = ['new', 'contacted', 'interested', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booked', 'not_interested', 'lost']
  const counts = Object.fromEntries(stages.map(s => [s, 0]))
  for (const r of data ?? []) counts[r.stage] = (counts[r.stage] ?? 0) + 1
  const total = data?.length ?? 0
  return stages.map((stage, i) => {
    const count = counts[stage] ?? 0
    const prev = i === 0 ? count : (counts[stages[i - 1]] ?? 0)
    return { stage, count, pct: total > 0 ? Math.round((count / total) * 100) : 0, dropOff: prev > 0 && i > 0 ? Math.round(((prev - count) / prev) * 100) : null }
  })
}

export async function getSLACompliance(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase.from('leads').select('id, created_at').eq('is_active', true)
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lte('created_at', to)
  const { data: leadsData } = await q

  const leadIds = (leadsData ?? []).map(l => l.id)
  
  const activitiesData = []
  if (leadIds.length > 0) {
    // Supabase allows up to ~2000 items in an 'in' filter, chunking if necessary. 
    // Assuming <2000 leads matched the date filter for now.
    const { data } = await supabase
      .from('lead_activities')
      .select('lead_id, created_at')
      .eq('type', 'call')
      .in('lead_id', leadIds)
    if (data) activitiesData.push(...data)
  }

  const firstContactMap = groupBy(activitiesData ?? [], a => a.lead_id)
  let compliant = 0, nonCompliant = 0
  const leads = leadsData ?? []
  for (const lead of leads) {
    const acts = (firstContactMap[lead.id] ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (acts.length === 0) { nonCompliant++; continue }
    const firstContactMs = new Date(acts[0].created_at).getTime() - new Date(lead.created_at).getTime()
    const twoHoursMs = 2 * 60 * 60 * 1000
    if (firstContactMs <= twoHoursMs) compliant++
    else nonCompliant++
  }
  const total = compliant + nonCompliant
  return { compliant, nonCompliant, total, rate: total > 0 ? Math.round((compliant / total) * 100) : 0 }
}

export async function getLeadAgeing() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('id, stage, updated_at')
    .eq('is_active', true)
    .not('stage', 'in', '(booked,not_interested,lost)')

  const now = Date.now()
  const buckets = { '0-7': 0, '8-15': 0, '16-30': 0, '31-60': 0, '60+': 0 }
  for (const l of data ?? []) {
    const days = Math.floor((now - new Date((l as any).updated_at ?? now).getTime()) / 86400000)
    if (days <= 7) buckets['0-7']++
    else if (days <= 15) buckets['8-15']++
    else if (days <= 30) buckets['16-30']++
    else if (days <= 60) buckets['31-60']++
    else buckets['60+']++
  }
  return Object.entries(buckets).map(([range, count]) => ({ range, count }))
}

export async function getSourcePerformance(from?: string, to?: string) {
  const supabase = await createClient()
  let lq = supabase.from('leads').select('id, utm_source, source').eq('is_active', true)
  if (from) lq = lq.gte('created_at', from)
  if (to) lq = lq.lte('created_at', to)
  const { data: leadsData } = await lq

  const { data: visitsData } = await supabase
    .from('site_visits')
    .select('id, leads!inner(utm_source, source)')

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('id, total_sale_value, clients!inner(leads!inner(utm_source, source))')
    .eq('status', 'confirmed')

  const src = (l: any) => l.utm_source || l.source || 'unknown'
  const agg: Record<string, { leads: number; visits: number; bookings: number; revenue: number }> = {}

  for (const l of leadsData ?? []) {
    const s = l.utm_source || l.source || 'unknown'
    agg[s] ??= { leads: 0, visits: 0, bookings: 0, revenue: 0 }
    agg[s].leads++
  }
  for (const v of visitsData ?? []) {
    const s = src((v as any).leads)
    if (agg[s]) agg[s].visits++
  }
  for (const b of bookingsData ?? []) {
    const s = src((b as any).clients?.leads)
    if (agg[s]) { agg[s].bookings++; agg[s].revenue += Number(b.total_sale_value ?? 0) }
  }
  return Object.entries(agg)
    .map(([source, d]) => ({
      source,
      ...d,
      conversionRate: d.leads ? Math.round((d.bookings / d.leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads)
}

export async function getLostLeadAnalysis(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase.from('leads').select('id, stage').eq('is_active', true).in('stage', ['not_interested', 'lost'])
  if (from) q = q.gte('updated_at', from)
  if (to) q = q.lte('updated_at', to)
  const { data: lostLeads } = await q

  const { data: activities } = await supabase
    .from('lead_activities')
    .select('lead_id, notes')
    .in('lead_id', (lostLeads ?? []).map(l => l.id))
    .not('notes', 'is', null)

  return { total: (lostLeads ?? []).length, sampleNotes: (activities ?? []).slice(0, 20).map(a => a.notes) }
}

// ── Pipeline Analytics (Phase 7) ────────────────────────────────────────────────

/** Wins vs losses + breakdown of loss reasons within a date range (by updated_at). */
export async function getWinLossReport(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('leads')
    .select('stage, loss_reason')
    .eq('is_active', true)
    .in('stage', ['closed_won', 'not_interested'])
  if (from) q = q.gte('updated_at', from)
  if (to) q = q.lte('updated_at', to)
  const { data } = await q

  let wins = 0
  let losses = 0
  const reasons: Record<string, number> = {}
  for (const l of data ?? []) {
    if (l.stage === 'closed_won') {
      wins++
    } else {
      losses++
      const r = (l.loss_reason as string | null)?.trim() || 'Unspecified'
      reasons[r] = (reasons[r] ?? 0) + 1
    }
  }
  const total = wins + losses
  return {
    wins,
    losses,
    winRate: total ? Math.round((wins / total) * 100) : 0,
    reasons: Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * Average first-response time per rep: minutes between lead creation and the
 * first outbound contact activity (call/whatsapp/sms/email). Leads created in
 * the range with an assignee.
 */
export async function getResponseTimeByRep(from?: string, to?: string) {
  const supabase = await createClient()
  let lq = supabase
    .from('leads')
    .select('id, assigned_to, created_at')
    .eq('is_active', true)
    .not('assigned_to', 'is', null)
  if (from) lq = lq.gte('created_at', from)
  if (to) lq = lq.lte('created_at', to)
  const { data: leads } = await lq
  if (!leads?.length) return []

  const leadIds = leads.map((l) => l.id)
  const { data: acts } = await supabase
    .from('lead_activities')
    .select('lead_id, created_at, type')
    .in('lead_id', leadIds)
    .in('type', ['call', 'whatsapp', 'sms', 'email'])
    .order('created_at', { ascending: true })

  // First contact timestamp per lead.
  const firstContact: Record<string, string> = {}
  for (const a of acts ?? []) {
    if (a.lead_id && !firstContact[a.lead_id]) firstContact[a.lead_id] = a.created_at
  }

  const advisorIds = [...new Set(leads.map((l) => l.assigned_to as string))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', advisorIds)
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const agg: Record<string, { totalLeads: number; responded: number; minutesSum: number }> = {}
  for (const l of leads) {
    const rep = l.assigned_to as string
    agg[rep] ??= { totalLeads: 0, responded: 0, minutesSum: 0 }
    agg[rep].totalLeads++
    const fc = firstContact[l.id]
    if (fc) {
      agg[rep].responded++
      agg[rep].minutesSum += (new Date(fc).getTime() - new Date(l.created_at).getTime()) / 60000
    }
  }

  return Object.entries(agg)
    .map(([rep, d]) => ({
      advisor: nameOf.get(rep) ?? 'Unknown',
      totalLeads: d.totalLeads,
      responded: d.responded,
      responseRate: d.totalLeads ? Math.round((d.responded / d.totalLeads) * 100) : 0,
      avgResponseMinutes: d.responded ? Math.round(d.minutesSum / d.responded) : null,
    }))
    .sort((a, b) => (a.avgResponseMinutes ?? Infinity) - (b.avgResponseMinutes ?? Infinity))
}

// ── Sales Reports ─────────────────────────────────────────────────────────────

export async function getAdvisorScorecard(from?: string, to?: string): Promise<any[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_advisor_scorecard', {
    p_from: from || null,
    p_to: to || null,
  })
  return (data as any[]) ?? []
}

export async function getBookingReport(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('bookings')
    .select('*, client:clients(full_name, phone), advisor:profiles!bookings_advisor_id_fkey(full_name), project:projects(name), plot:plots(plot_number)')
    .eq('status', 'confirmed')
    .order('booking_date', { ascending: false })
    .limit(200)
  if (from) q = q.gte('booking_date', from)
  if (to) q = q.lte('booking_date', to)
  const { data } = await q
  return data ?? []
}

export async function getSiteVisitReport(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('site_visits')
    .select('*, lead:leads(full_name, phone, source), advisor:profiles!site_visits_accompanied_by_fkey(full_name), project:projects(name)')
    .order('visited_at', { ascending: false })
    .limit(200)
  if (from) q = q.gte('visited_at', from)
  if (to) q = q.lte('visited_at', to)
  const { data } = await q
  return data ?? []
}

// ── Financial Reports ─────────────────────────────────────────────────────────

export async function getCollectionReport(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('payments')
    .select('*, client:clients(full_name), booking:bookings(booking_number, project:projects(name))')
    .eq('status', 'paid')
    .order('paid_date', { ascending: false })
    .limit(500)
  if (from) q = q.gte('paid_date', from)
  if (to) q = q.lte('paid_date', to)
  const { data } = await q
  const total = (data ?? []).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0)
  return { payments: data ?? [], total }
}

export async function getOutstandingReport() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('payments')
    .select('*, client:clients(full_name, phone), booking:bookings(booking_number, project:projects(name))')
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(500)

  const rows = (data ?? []).map(p => ({
    ...p,
    daysOverdue: p.due_date < today ? Math.floor((new Date(today).getTime() - new Date(p.due_date).getTime()) / 86400000) : 0,
  }))
  const total = rows.reduce((s, p) => s + Number(p.amount_due ?? 0), 0)
  const overdue = rows.filter(p => p.daysOverdue > 0).reduce((s, p) => s + Number(p.amount_due ?? 0), 0)
  return { payments: rows, total, overdue }
}

export async function getBrokerCommissions(from?: string, to?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('broker_commissions')
    .select('*, broker:brokers(name, phone), booking:bookings(booking_number, total_sale_value, project:projects(name))')
    .order('created_at', { ascending: false })
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lte('created_at', to)
  const { data } = await q
  const due = (data ?? []).filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0)
  const paid = (data ?? []).filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0)
  return { commissions: data ?? [], due, paid }
}

// ── Inventory Reports ─────────────────────────────────────────────────────────

export async function getInventoryAvailability() {
  const supabase = await createClient()
  const [projectsRes, plotsRes] = await Promise.all([
    supabase.from('projects').select('id, name, city'),
    supabase.from('plots').select('id, project_id, status'),
  ])
  const plots = plotsRes.data ?? []
  return (projectsRes.data ?? []).map(p => {
    const mine = plots.filter(pl => pl.project_id === p.id)
    return {
      project: p.name,
      city: p.city,
      total: mine.length,
      available: mine.filter(pl => pl.status === 'available').length,
      held: mine.filter(pl => pl.status === 'held').length,
      booked: mine.filter(pl => pl.status === 'booked').length,
      sold: mine.filter(pl => pl.status === 'sold').length,
    }
  })
}

export async function getPlotAgeing() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plots')
    .select('id, plot_number, status, updated_at, project:projects(name)')
    .eq('status', 'available')
    .order('updated_at', { ascending: true })

  const now = Date.now()
  return (data ?? []).map(p => {
    const days = Math.floor((now - new Date((p as any).updated_at ?? now).getTime()) / 86400000)
    return { ...p, daysAvailable: days }
  })
}

export async function getSoftHoldReport() {
  const supabase = await createClient()
  const today = new Date().toISOString()
  const { data } = await supabase
    .from('plot_holds_log')
    .select('*, plot:plots(plot_number), project:projects(name), advisor:profiles!plot_holds_log_held_by_fkey(full_name), lead:leads(full_name, phone)')
    .is('released_at', null)
    .order('expires_at', { ascending: true })

  return (data ?? []).map((h: any) => ({
    ...h,
    isExpired: h.expires_at < today,
  }))
}
