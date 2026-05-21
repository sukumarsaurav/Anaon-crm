'use server'

import { createClient } from '@/lib/supabase/server'
import type { Broker, BrokerStats, BrokerLeadRegistration, BrokerCommissionRow, BrokerWithStats } from '@/types/brokers'

// ── Admin queries ──────────────────────────────────────────────────

export async function getBrokers(filters: {
  status?: string
  search?: string
  limit?: number
  offset?: number
} = {}): Promise<{ brokers: Broker[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('brokers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) query = query.or(`full_name.ilike.%${filters.search}%,firm_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)

  const limit  = filters.limit  ?? 20
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { brokers: (data ?? []) as Broker[], total: count ?? 0 }
}

export async function getBrokerById(id: string): Promise<Broker | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('brokers').select('*').eq('id', id).single()
  return data as Broker | null
}

export async function getBrokerStats(brokerId: string): Promise<BrokerStats> {
  const supabase = await createClient()

  const [
    { data: leads },
    { data: commissions },
  ] = await Promise.all([
    supabase.from('broker_lead_registrations').select('status').eq('broker_id', brokerId),
    supabase.from('broker_commissions').select('commission_amount, status').eq('broker_id', brokerId),
  ])

  const leadRows   = leads ?? []
  const commRows   = commissions ?? []
  const converted  = leadRows.filter((l) => l.status === 'converted').length
  const totalLeads = leadRows.length

  const sumByStatus = (s: string) =>
    commRows.filter((c) => c.status === s).reduce((a, c) => a + (c.commission_amount ?? 0), 0)

  return {
    total_leads:         totalLeads,
    total_bookings:      converted,
    commission_earned:   sumByStatus('pending') + sumByStatus('approved') + sumByStatus('paid'),
    commission_pending:  sumByStatus('pending'),
    commission_paid:     sumByStatus('paid'),
    conversion_rate:     totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0,
    active_since:        null,
  }
}

export async function getBrokerCommissions(filters: {
  broker_id?: string
  status?: string
  limit?: number
  offset?: number
} = {}): Promise<{ commissions: BrokerCommissionRow[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('broker_commissions')
    .select(`
      *,
      broker:brokers!broker_commissions_broker_id_fkey(id, full_name, firm_name),
      booking:bookings!broker_commissions_booking_id_fkey(id, booking_number)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.broker_id) query = query.eq('broker_id', filters.broker_id)
  if (filters.status)    query = query.eq('status', filters.status)

  const limit  = filters.limit  ?? 50
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { commissions: (data ?? []) as BrokerCommissionRow[], total: count ?? 0 }
}

export async function getBrokerLeadRegistrations(brokerId: string): Promise<BrokerLeadRegistration[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('broker_lead_registrations')
    .select(`*, project:projects!broker_lead_registrations_project_id_fkey(id, name, city)`)
    .eq('broker_id', brokerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as BrokerLeadRegistration[]
}

export async function getTopBrokers(limit = 10): Promise<BrokerWithStats[]> {
  const supabase = await createClient()
  const { data: brokers } = await supabase
    .from('brokers')
    .select('*')
    .eq('status', 'approved')
    .order('full_name')
    .limit(limit)

  if (!brokers?.length) return []

  const brokerIds = brokers.map((b) => b.id)

  const [{ data: leads }, { data: commissions }] = await Promise.all([
    supabase.from('broker_lead_registrations').select('broker_id, status').in('broker_id', brokerIds),
    supabase.from('broker_commissions').select('broker_id, commission_amount, status').in('broker_id', brokerIds),
  ])

  return brokers.map((b) => {
    const bl = (leads ?? []).filter((l) => l.broker_id === b.id)
    const bc = (commissions ?? []).filter((c) => c.broker_id === b.id)
    const converted = bl.filter((l) => l.status === 'converted').length
    const earned = bc.filter((c) => ['pending','approved','paid'].includes(c.status))
      .reduce((a, c) => a + (c.commission_amount ?? 0), 0)
    const pending = bc.filter((c) => c.status === 'pending').reduce((a, c) => a + (c.commission_amount ?? 0), 0)
    return {
      ...b,
      total_leads:              bl.length,
      total_bookings:           converted,
      total_commission_earned:  earned,
      total_commission_pending: pending,
      conversion_rate:          bl.length > 0 ? Math.round((converted / bl.length) * 100) : 0,
    } as BrokerWithStats
  })
}

// ── Broker portal queries ──────────────────────────────────────────

export async function getBrokerByAuthUser(userId: string): Promise<Broker | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('brokers').select('*').eq('auth_user_id', userId).single()
  return data as Broker | null
}

export async function getBrokerPortalCommissions(brokerId: string): Promise<BrokerCommissionRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('broker_commissions')
    .select(`*, booking:bookings!broker_commissions_booking_id_fkey(id, booking_number)`)
    .eq('broker_id', brokerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as BrokerCommissionRow[]
}

export async function getPortalAvailablePlots() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('plots')
    .select(`
      id, plot_number, type, size_sqyd, size_sqft, facing, base_price, total_price,
      project:projects!plots_project_id_fkey(id, name, city, type)
    `)
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}
