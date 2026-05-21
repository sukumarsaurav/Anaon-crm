'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

function serviceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type AuditAction =
  | 'login' | 'logout' | 'login_failed' | 'login_locked'
  | 'lead_created' | 'lead_updated' | 'lead_deleted' | 'lead_stage_changed'
  | 'booking_created' | 'booking_cancelled'
  | 'payment_created' | 'payment_updated'
  | 'document_viewed' | 'document_uploaded'
  | 'user_created' | 'user_updated' | 'user_deactivated' | 'role_changed'
  | 'export_leads' | 'export_report'
  | '2fa_enabled' | '2fa_disabled' | '2fa_failed'
  | 'session_revoked' | 'ip_whitelist_updated'
  | 'sensitive_field_viewed'

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
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? headersList.get('x-real-ip')
      ?? null
    const ua = headersList.get('user-agent') ?? null

    await serviceSupabase().from('audit_logs').insert({
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
      ip_address, user_agent, metadata, created_at,
      profiles:user_id (full_name, role)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (userId) q = q.eq('user_id', userId)
  if (action) q = q.eq('action', action)
  if (tableName) q = q.eq('table_name', tableName)
  if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`)
  if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`)

  return q
}
