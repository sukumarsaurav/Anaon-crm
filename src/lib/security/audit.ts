// Plain server module, not a server action file. With 'use server' every export was callable from
// any browser, so anyone signed in could write audit entries in another user's name.
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type AuditAction =
  | 'login' | 'logout' | 'login_failed' | 'login_locked'
  | 'lead_created' | 'lead_updated' | 'lead_deleted' | 'lead_stage_changed'
  | 'booking_created' | 'booking_cancelled'
  | 'payment_created' | 'payment_updated'
  | 'document_viewed' | 'document_uploaded'
  | 'user_created' | 'user_updated' | 'user_deactivated' | 'role_changed'
  | 'export_leads' | 'export_report'
  | 'session_revoked' | 'ip_whitelist_updated'
  | 'sensitive_field_viewed'
  | 'booking_approved' | 'booking_rejected'
  | 'payment_recorded' | 'payment_waived' | 'payment_deleted'
  | 'plot_updated' | 'commission_approved' | 'commission_paid'
  | 'kyc_updated' | 'client_updated' | 'account_unlocked'
  | 'data_erased'

export async function writeAuditLog({
  userId,
  action,
  tableName,
  recordId,
  oldValues,
  newValues,
  metadata,
}: {
  userId: string
  action: AuditAction
  tableName?: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  try {
    // Outside a request (crons, tests) there are no headers; the entry is still written.
    let ip: string | null = null
    let ua: string | null = null
    try {
      const headersList = await headers()
      ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headersList.get('x-real-ip') ?? null
      ua = headersList.get('user-agent') ?? null
    } catch { /* no request context */ }

    await createServiceClient().from('audit_logs').insert({
      user_id: userId,
      action,
      table_name: tableName ?? null,
      record_id: recordId ?? null,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      ip_address: ip,
      user_agent: ua,
      metadata: metadata ?? null,
    })
  } catch {
    // Audit log failures must never break the main flow
  }
}

export async function getAuditLogs({
  userId,
  action,
  tableName,
  startDate,
  endDate,
  page = 1,
  pageSize = 50,
}: {
  userId?: string
  action?: string
  tableName?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()
  let q = supabase
    .from('audit_logs')
    .select(`
      id, action, table_name, record_id, old_values, new_values,
      user_id, ip_address, user_agent, metadata, created_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (userId) q = q.eq('user_id', userId)
  if (action) q = q.eq('action', action)
  if (tableName) q = q.eq('table_name', tableName)
  if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`)
  if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`)

  const res = await q
  // audit_logs.user_id references auth.users, not profiles, so `profiles:user_id (...)` was not a
  // valid embed: the whole query failed and the Audit Log page (and CSV export) showed nothing.
  // Look the names up separately.
  const rows = res.data ?? []
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const names = new Map<string, { full_name: string; role: string }>()
  if (ids.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', ids)
    for (const p of profiles ?? []) names.set(p.id, { full_name: p.full_name, role: p.role })
  }
  if (res.error) console.error('[audit] log query failed:', res.error.message)
  return { ...res, data: rows.map((r) => ({ ...r, profiles: (r.user_id && names.get(r.user_id)) || null })) }
}
