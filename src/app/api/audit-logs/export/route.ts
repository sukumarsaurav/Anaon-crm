import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuditLogs } from '@/lib/security/audit'
import { writeAuditLog } from '@/lib/security/audit'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const url = new URL(req.url)
  const params = {
    userId: url.searchParams.get('user_id') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    startDate: url.searchParams.get('start_date') ?? undefined,
    endDate: url.searchParams.get('end_date') ?? undefined,
    page: 1,
    pageSize: 10000,
  }

  const { data: logs } = await getAuditLogs(params)

  const headers = ['ID', 'Timestamp', 'User', 'Action', 'Table', 'Record ID', 'IP Address', 'Old Values', 'New Values', 'Metadata']
  const rows = (logs ?? []).map((log: any) => [
    log.id,
    new Date(log.created_at).toISOString(),
    log.profiles?.full_name ?? '',
    log.action,
    log.table_name ?? '',
    log.record_id ?? '',
    String(log.ip_address ?? ''),
    log.old_values ? JSON.stringify(log.old_values) : '',
    log.new_values ? JSON.stringify(log.new_values) : '',
    log.metadata ? JSON.stringify(log.metadata) : '',
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  // Log this export action
  await writeAuditLog({
    userId: user.id,
    action: 'export_report',
    tableName: 'audit_logs',
    metadata: { rows: rows.length, filters: params },
  })

  const filename = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
