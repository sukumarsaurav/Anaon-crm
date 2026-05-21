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
  const curr = monthBounds(0)
  const prev = monthBounds(-1)

  const [leadsAll, visitsAll, bookingsAll, paymentsAll] = await Promise.all([
    supabase.from('leads').select('id, created_at, utm_source, source').eq('is_active', true),
    supabase.from('site_visits').select('id, created_at'),
    supabase.from('bookings').select('id, created_at, booking_date, total_sale_value, status, project_id'),
    supabase.from('payments').select('id, amount_paid, paid_date, amount_due, due_date, status'),
  ])

  const leads = leadsAll.data ?? []
  const visits = visitsAll.data ?? []
  const bookings = bookingsAll.data ?? []
  const payments = paymentsAll.data ?? []

  const inRange = (dateStr: string | null, s: string, e: string) =>
    dateStr !== null && dateStr >= s && dateStr <= e

  const currLeads = leads.filter(l => inRange(l.created_at?.split('T')[0] ?? null, curr.start, curr.end))
  const prevLeads = leads.filter(l => inRange(l.created_at?.split('T')[0] ?? null, prev.start, prev.end))
  const currVisits = visits.filter(v => inRange(v.created_at?.split('T')[0] ?? null, curr.start, curr.end))
  const prevVisits = visits.filter(v => inRange(v.created_at?.split('T')[0] ?? null, prev.start, prev.end))
  const currBookings = bookings.filter(b => b.status === 'confirmed' && inRange(b.booking_date, curr.start, curr.end))
  const prevBookings = bookings.filter(b => b.status === 'confirmed' && inRange(b.booking_date, prev.start, prev.end))

  const currRevenue = currBookings.reduce((s, b) => s + Number(b.total_sale_value ?? 0), 0)
  const prevRevenue = prevBookings.reduce((s, b) => s + Number(b.total_sale_value ?? 0), 0)

  const currCollections = payments
    .filter(p => p.status === 'paid' && inRange(p.paid_date, curr.start, curr.end))
    .reduce((s, p) => s + Number(p.amount_paid ?? 0), 0)

  const outstanding = payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((s, p) => s + Number(p.amount_due ?? 0), 0)

  const pct = (a: number, b: number) => b === 0 ? null : Math.round(((a - b) / b) * 100)

  return {
    leads:       { curr: currLeads.length,    prev: prevLeads.length,    trend: pct(currLeads.length, prevLeads.length) },
    visits:      { curr: currVisits.length,   prev: prevVisits.length,   trend: pct(currVisits.length, prevVisits.length) },
    bookings:    { curr: currBookings.length, prev: prevBookings.length, trend: pct(currBookings.length, prevBookings.length) },
    revenue:     { curr: currRevenue,         prev: prevRevenue,         trend: pct(currRevenue, prevRevenue) },
    collections: currCollections,
    outstanding,
    leadToVisitRate: currLeads.length > 0 ? Math.round((currVisits.length / currLeads.length) * 100) : 0,
    visitToBookingRate: currVisits.length > 0 ? Math.round((currBookings.length / currVisits.length) * 100) : 0,
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

  let aq = supabase.from('lead_activities').select('lead_id, created_at').eq('type', 'call')
  const { data: activitiesData } = await aq

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
    .map(([source, d]) => ({ source, ...d }))
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

// ── Sales Reports ─────────────────────────────────────────────────────────────

export async function getAdvisorScorecard(from?: string, to?: string) {
  const supabase = await createClient()
  const [profilesRes, leadsRes, activitiesRes, visitsRes, bookingsRes, targetsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, designation, monthly_target_bookings, monthly_target_revenue').eq('is_active', true),
    supabase.from('leads').select('id, assigned_to').eq('is_active', true),
    supabase.from('lead_activities').select('lead_id, type, performed_by, created_at'),
    supabase.from('site_visits').select('id, accompanied_by, created_at'),
    supabase.from('bookings').select('id, advisor_id, total_sale_value, booking_date').eq('status', 'confirmed'),
    supabase.from('team_targets').select('user_id, target_bookings, target_revenue, month, year'),
  ])

  const profiles = profilesRes.data ?? []
  const leads = leadsRes.data ?? []
  const acts = activitiesRes.data ?? []
  const visits = visitsRes.data ?? []
  const bookings = bookingsRes.data ?? []

  const inRange = (d: string) => {
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }

  return profiles.map(p => {
    const myLeads = leads.filter(l => l.assigned_to === p.id).length
    const myActs = acts.filter(a => a.performed_by === p.id && inRange(a.created_at.split('T')[0]))
    const myCalls = myActs.filter(a => a.type === 'call').length
    const myFollowups = myActs.filter(a => a.type === 'follow_up').length
    const myVisits = visits.filter(v => v.accompanied_by === p.id && inRange((v.created_at ?? '').split('T')[0])).length
    const myBookings = bookings.filter(b => b.advisor_id === p.id && (b.booking_date ? inRange(b.booking_date) : true))
    const myRevenue = myBookings.reduce((s, b) => s + Number(b.total_sale_value ?? 0), 0)
    return {
      id: p.id,
      name: p.full_name,
      designation: p.designation,
      leads: myLeads,
      calls: myCalls,
      followUps: myFollowups,
      visits: myVisits,
      bookings: myBookings.length,
      revenue: myRevenue,
      targetBookings: p.monthly_target_bookings ?? 0,
      targetRevenue: Number(p.monthly_target_revenue ?? 0),
    }
  }).sort((a, b) => b.bookings - a.bookings)
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
