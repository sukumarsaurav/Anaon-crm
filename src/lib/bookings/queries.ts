'use server'

import { createClient } from '@/lib/supabase/server'
import type { BookingFull, BookingStats, BrokerCommission, AllotmentLetterData, DemandLetterData } from '@/types/bookings'
import type { Payment } from '@/types/clients'

const BOOKING_SELECT = `
  *,
  client:clients!bookings_client_id_fkey(id, full_name, phone, email, pan_encrypted, permanent_address),
  plot:plots!bookings_plot_id_fkey(id, plot_number, size_sqyd, size_sqft, facing, type, base_price, total_price),
  project:projects!bookings_project_id_fkey(id, name, city, type, rera_number, address),
  advisor:profiles!bookings_advisor_id_fkey(id, full_name, phone),
  approver:profiles!bookings_approved_by_fkey(id, full_name),
  broker:brokers!bookings_broker_id_fkey(id, full_name, firm_name, commission_rate)
`

export async function getBookings(filters: {
  status?:     string
  project_id?: string
  advisor_id?: string
  search?:     string
  from_date?:  string
  to_date?:    string
  limit?:      number
  offset?:     number
} = {}): Promise<{ bookings: BookingFull[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.status)     query = query.eq('status', filters.status)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.advisor_id) query = query.eq('advisor_id', filters.advisor_id)
  if (filters.from_date)  query = query.gte('booking_date', filters.from_date)
  if (filters.to_date)    query = query.lte('booking_date', filters.to_date)

  if (filters.search) {
    // Search via client name — join handled server-side after fetch
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .ilike('full_name', `%${filters.search}%`)
    const ids = (clients ?? []).map((c) => c.id)
    if (ids.length) query = query.in('client_id', ids)
    else return { bookings: [], total: 0 }
  }

  const limit  = filters.limit  ?? 20
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { bookings: (data ?? []) as BookingFull[], total: count ?? 0 }
}

export async function getBookingById(id: string): Promise<BookingFull | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', id)
    .single()
  return data as BookingFull | null
}

export async function getBookingStats(): Promise<BookingStats> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select('status, total_sale_value')

  const rows = data ?? []
  const sum  = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + (r.total_sale_value ?? 0), 0)

  return {
    total:            rows.length,
    pending_approval: rows.filter((r) => r.status === 'pending_approval').length,
    confirmed:        rows.filter((r) => r.status === 'confirmed').length,
    cancelled:        rows.filter((r) => r.status === 'cancelled').length,
    total_value:      sum('confirmed'),
    total_collected:  0, // computed separately via payments
  }
}

export async function getPendingApprovals(): Promise<BookingFull[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true })
  return (data ?? []) as BookingFull[]
}

export async function getBookingPayments(bookingId: string): Promise<Payment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('installment_number')
  return (data ?? []) as Payment[]
}

export async function getBookingCommission(bookingId: string): Promise<BrokerCommission | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('broker_commissions')
    .select('*')
    .eq('booking_id', bookingId)
    .single()
  return data as BrokerCommission | null
}

export async function getAvailablePlots(projectId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plots')
    .select('id, plot_number, size_sqyd, size_sqft, type, facing, base_price, total_price, configuration')
    .eq('project_id', projectId)
    .eq('status', 'available')
    .order('plot_number')
  return data ?? []
}

export async function getActiveBrokers() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brokers')
    .select('id, full_name, firm_name, commission_rate, phone')
    .eq('status', 'approved')
    .order('full_name')
  return data ?? []
}

export async function getAllotmentLetterData(bookingId: string): Promise<AllotmentLetterData | null> {
  const booking = await getBookingById(bookingId)
  if (!booking) return null
  return { booking, generated_at: new Date().toISOString() }
}

export async function getDemandLetterData(
  bookingId: string,
  paymentId: string,
): Promise<DemandLetterData | null> {
  const [booking, supabase] = await Promise.all([
    getBookingById(bookingId),
    createClient(),
  ])
  if (!booking) return null

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('booking_id', bookingId)
    .single()

  if (!payment) return null

  return {
    booking,
    payment:         payment as Payment,
    generated_at:    new Date().toISOString(),
    bank_name:       'HDFC Bank',
    account_number:  'XXXXXXXXXXXX',
    ifsc:            'HDFC0001234',
    late_charge_pct: 0.05,
  }
}
