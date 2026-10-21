import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { buildPayslip } from '@/lib/pdf/builders'
import { writeAuditLog } from '@/lib/security/audit'

/** An admin may open any slip; an employee only their own, once the run is finalized (same as RLS). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slipId: string }> }) {
  const session = await getProfile()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slipId } = await params
  const pdf = await buildPayslip(slipId)
  const isAdmin = session.profile?.role === 'admin'
  const isOwn = pdf?.userId === session.user.id
  // Same answer for "missing" and "not yours", so slip ids can't be probed.
  if (!pdf || !(isAdmin || (isOwn && pdf.runCompleted))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!isOwn) {
    await writeAuditLog({ userId: session.user.id, action: 'document_viewed', tableName: 'payroll_slips', recordId: slipId, metadata: { type: 'payslip' } })
  }
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdf.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
