'use server'

import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import type {
  Client, Booking, Payment, ClientDocument,
  Complaint, PaymentSummary, TimelineEvent,
} from '@/types/clients'

// ── Clients ───────────────────────────────────────────────────

export async function getClients(filters: {
  search?:     string
  kyc_status?: string
  project_id?: string
  limit?:      number
  offset?:     number
} = {}): Promise<{ clients: Client[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.search) {
    query = query.or(
      `full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }
  if (filters.kyc_status) query = query.eq('kyc_status', filters.kyc_status)

  // Filter by project via bookings subquery
  if (filters.project_id) {
    const { data: bookingClients } = await supabase
      .from('bookings')
      .select('client_id')
      .eq('project_id', filters.project_id)
    const ids = (bookingClients ?? []).map((b) => b.client_id)
    if (ids.length) query = query.in('id', ids)
    else return { clients: [], total: 0 }
  }

  if (filters.limit)  query = query.limit(filters.limit)
  if (filters.offset) query = query.range(filters.offset, (filters.offset + (filters.limit ?? 20)) - 1)

  const { data, count } = await query
  return { clients: (data ?? []) as Client[], total: count ?? 0 }
}

export async function getClientById(id: string): Promise<Client | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('clients').select('*').eq('id', id).single()
  return data as Client | null
}

// ── Bookings ──────────────────────────────────────────────────

export async function getClientBookings(clientId: string): Promise<Booking[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(`
      *,
      plot:plots!bookings_plot_id_fkey(id, plot_number, size_sqyd, size_sqft, facing),
      project:projects!bookings_project_id_fkey(id, name, city, type),
      advisor:profiles!bookings_advisor_id_fkey(id, full_name)
    `)
    .eq('client_id', clientId)
    .order('booking_date', { ascending: false })
  return (data ?? []) as Booking[]
}

// ── Payments ──────────────────────────────────────────────────

export async function getBookingPayments(bookingId: string): Promise<Payment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('installment_number')
  return (data ?? []) as Payment[]
}

export async function getClientPayments(clientId: string): Promise<Payment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('client_id', clientId)
    .order('due_date')
  return (data ?? []) as Payment[]
}

export async function getPaymentSummary(bookingId: string): Promise<PaymentSummary> {
  const payments = await getBookingPayments(bookingId)
  const today = new Date().toISOString().split('T')[0]

  const total_due   = payments.reduce((s, p) => s + p.amount_due + (p.late_charge ?? 0), 0)
  const total_paid  = payments.reduce((s, p) => s + (p.amount_paid ?? 0), 0)
  const outstanding = Math.max(0, total_due - total_paid)
  const overdue     = payments.filter((p) => p.status === 'pending' && p.due_date < today)
  const pending     = payments
    .filter((p) => p.status === 'pending' && p.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return {
    total_due,
    total_paid,
    outstanding,
    overdue_count:   overdue.length,
    next_due_date:   pending[0]?.due_date ?? null,
    next_due_amount: pending[0]?.amount_due ?? null,
  }
}

// ── Documents ─────────────────────────────────────────────────

export async function getClientDocuments(clientId: string): Promise<ClientDocument[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_documents')
    .select(`
      *,
      uploader:profiles!client_documents_uploaded_by_fkey(id, full_name),
      verifier:profiles!client_documents_verified_by_fkey(id, full_name)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return (data ?? []) as ClientDocument[]
}

// ── Complaints ────────────────────────────────────────────────

export async function getClientComplaints(clientId: string): Promise<Complaint[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('complaints')
    .select('*, assignee:profiles!complaints_assigned_to_fkey(id, full_name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Complaint[]
}

// ── Communication Timeline ────────────────────────────────────

export async function getClientTimeline(clientId: string): Promise<TimelineEvent[]> {
  const supabase = await createClient()

  // 1. Get lead_id first
  const { data: leadData } = await supabase.from('clients').select('lead_id').eq('id', clientId).single()
  const leadId = leadData?.lead_id

  // 2. Fetch from all sources in parallel
  const [
    { data: leadActivitiesData },
    { data: siteVisitsData },
    payments,
    docs,
    complaints,
  ] = await Promise.all([
    leadId ? supabase
      .from('lead_activities')
      .select('id, type, note, created_at, created_by_profile:profiles!lead_activities_created_by_fkey(full_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(30) : Promise.resolve({ data: [] }),
    leadId ? supabase
      .from('site_visits')
      .select('id, visit_date, status, visit_type, advisor_notes, created_at')
      .eq('lead_id', leadId)
      .order('visit_date', { ascending: false })
      .limit(10) : Promise.resolve({ data: [] }),
    supabase
      .from('payments')
      .select('id, installment_number, description, amount_paid, paid_date, status, created_at')
      .eq('client_id', clientId)
      .not('paid_date', 'is', null)
      .order('paid_date', { ascending: false })
      .limit(20),
    supabase
      .from('client_documents')
      .select('id, name, document_type, status, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('complaints')
      .select('id, ticket_number, category, status, description, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const leadActivities = (leadActivitiesData ?? []) as any[]
  const siteVisits = (siteVisitsData ?? []) as any[]

  const events: TimelineEvent[] = []

  for (const a of leadActivities) {
    events.push({
      id:          `act-${a.id}`,
      type:        'activity',
      date:        a.created_at,
      title:       a.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: a.note,
    })
  }

  for (const v of siteVisits) {
    events.push({
      id:          `visit-${v.id}`,
      type:        'visit',
      date:        v.visit_date,
      title:       `Site Visit — ${v.visit_type ?? 'General'}`,
      description: v.advisor_notes,
    })
  }

  for (const p of (payments.data ?? [])) {
    if (p.paid_date) {
      events.push({
        id:          `pay-${p.id}`,
        type:        'payment',
        date:        p.paid_date,
        title:       `Payment Received — Installment #${p.installment_number}`,
        description: `${formatCurrency(Number(p.amount_paid), { mode: 'exact' })} received`,
      })
    }
  }

  for (const d of (docs.data ?? [])) {
    events.push({
      id:          `doc-${d.id}`,
      type:        'document',
      date:        d.created_at,
      title:       `Document ${d.status === 'verified' ? 'Verified' : 'Uploaded'} — ${d.name ?? d.document_type}`,
      description: null,
    })
  }

  for (const c of (complaints.data ?? [])) {
    events.push({
      id:          `cmp-${c.id}`,
      type:        'complaint',
      date:        c.created_at,
      title:       `Complaint ${c.ticket_number} — ${c.category?.replace(/_/g, ' ')}`,
      description: c.description,
    })
  }

  return events.sort((a, b) => b.date.localeCompare(a.date))
}
