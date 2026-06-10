'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortalClientData, ConstructionUpdate, PaymentExtensionRequest } from '@/types/portal'
import type { Client, Payment, ClientDocument, Complaint } from '@/types/clients'
import type { BookingFull } from '@/types/bookings'

// ── Portal data ────────────────────────────────────────────────────
// Note: getPortalSession() moved to '@/lib/portal/session' so it can be wrapped
// in React cache() (this file is 'use server', where exports must be actions).

export async function getPortalClientData(clientId: string): Promise<PortalClientData> {
  const supabase = await createClient()

  const BOOKING_SELECT = `
    *,
    client:clients!bookings_client_id_fkey(id, full_name, phone, email, pan_encrypted, permanent_address),
    plot:plots!bookings_plot_id_fkey(id, plot_number, size_sqyd, size_sqft, facing, type, base_price, total_price),
    project:projects!bookings_project_id_fkey(id, name, city, type, rera_number, address),
    advisor:profiles!bookings_advisor_id_fkey(id, full_name, phone),
    approver:profiles!bookings_approved_by_fkey(id, full_name),
    broker:brokers!bookings_broker_id_fkey(id, full_name, firm_name, commission_rate)
  `

  const [
    { data: bookings },
    { data: documents },
    { data: complaints },
  ] = await Promise.all([
    supabase.from('bookings').select(BOOKING_SELECT)
      .eq('client_id', clientId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('client_documents').select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase.from('complaints').select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
  ])

  const booking = bookings?.[0] as BookingFull | null

  let payments: Payment[] = []
  let constructionUpdates: ConstructionUpdate[] = []

  if (booking) {
    const [{ data: paymentsData }, { data: updatesData }] = await Promise.all([
      supabase.from('payments').select('*')
        .eq('booking_id', booking.id)
        .order('installment_number'),
      supabase.from('construction_updates')
        .select('*, poster:profiles!construction_updates_posted_by_fkey(id, full_name)')
        .eq('project_id', booking.project_id)
        .eq('is_published', true)
        .order('update_date', { ascending: false }),
    ])
    payments          = (paymentsData ?? []) as Payment[]
    constructionUpdates = (updatesData ?? []) as unknown as ConstructionUpdate[]
  }

  const paidTotal    = payments.reduce((s, p) => s + (p.amount_paid ?? 0), 0)
  const totalDue     = payments.reduce((s, p) => s + p.amount_due, 0)
  const overdueCount = payments.filter(
    (p) => p.status === 'pending' && p.due_date < new Date().toISOString().split('T')[0]
  ).length
  const pending = payments
    .filter((p) => p.status === 'pending')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return {
    client:             (await supabase.from('clients').select('*').eq('id', clientId).single()).data as Client,
    booking,
    payments,
    documents:          (documents ?? []) as ClientDocument[],
    complaints:         (complaints ?? []) as Complaint[],
    constructionUpdates,
    paymentSummary: {
      total_due:       totalDue,
      total_paid:      paidTotal,
      outstanding:     totalDue - paidTotal,
      overdue_count:   overdueCount,
      next_due_date:   pending[0]?.due_date ?? null,
      next_due_amount: pending[0]?.amount_due ?? null,
    },
  }
}

// ── Construction updates (admin) ───────────────────────────────────

export async function getConstructionUpdates(projectId: string): Promise<ConstructionUpdate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('construction_updates')
    .select('*, poster:profiles!construction_updates_posted_by_fkey(id, full_name)')
    .eq('project_id', projectId)
    .order('update_date', { ascending: false })
  return (data ?? []) as unknown as ConstructionUpdate[]
}

// ── Payment extension requests (admin) ────────────────────────────

export async function getPaymentExtensionRequests(status?: string): Promise<PaymentExtensionRequest[]> {
  const supabase = await createClient()
  let query = supabase
    .from('payment_extension_requests')
    .select(`
      *,
      payment:payments!payment_extension_requests_payment_id_fkey(id, installment_number, amount_due, due_date),
      reviewer:profiles!payment_extension_requests_reviewed_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  const { data } = await query
  return (data ?? []) as unknown as PaymentExtensionRequest[]
}
