import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { writeAuditLog } from '@/lib/security/audit'
import { loadBankRows } from '@/lib/hr/payrollExport'
import { buildBankCsv, splitPayable, BANK_FORMATS } from '@/lib/hr/bankExport'

/**
 * Salary transfer file for a finalized run (admin only, audited: it contains account numbers).
 * People with missing or malformed bank details are left out; the payroll page lists them first.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getProfile()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { runId } = await params
  const format = req.nextUrl.searchParams.get('format') ?? 'generic'
  if (!BANK_FORMATS[format]) return NextResponse.json({ error: 'Unknown format' }, { status: 400 })

  const data = await loadBankRows(runId)
  if (!data) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
  if (data.run.status !== 'completed') return NextResponse.json({ error: 'Finalize the run before exporting it' }, { status: 409 })

  const { ok, missing } = splitPayable(data.rows)
  const csv = buildBankCsv(format, ok, data.narration)
  await writeAuditLog({
    userId: session.user.id, action: 'export_report', tableName: 'payroll_runs', recordId: runId,
    metadata: { type: 'bank_transfer', format, rows: ok.length, held_back: missing.length, total: ok.reduce((t, r) => t + r.amount, 0) },
  })

  const name = `salary-${data.run.year}-${String(data.run.month).padStart(2, '0')}-${format}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'X-Held-Back': String(missing.length),
    },
  })
}
