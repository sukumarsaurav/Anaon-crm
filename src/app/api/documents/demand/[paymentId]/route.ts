import { NextRequest, NextResponse } from 'next/server'
import { buildDemandForPayment } from '@/lib/pdf/builders'
import { canReadPayment } from '@/lib/pdf/access'

/** Staff download of an installment's demand letter (rendered, not saved). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const access = await canReadPayment(paymentId)
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Payment not found' }, { status: access.status })

  const pdf = await buildDemandForPayment(paymentId, { store: false })
  if (!pdf) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdf.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
