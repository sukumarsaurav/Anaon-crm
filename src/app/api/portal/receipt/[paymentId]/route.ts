import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal/session'
import { createServiceClient } from '@/lib/supabase/service'
import { buildReceiptForPayment } from '@/lib/pdf/builders'

/** Download a payment receipt — client-portal session auth, paid installments only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { paymentId } = await params
  const supabase = createServiceClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('client_id, status')
    .eq('id', paymentId)
    .single()

  if (!payment || payment.client_id !== session.client.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (payment.status !== 'paid') {
    return NextResponse.json({ error: 'Receipt available once the installment is paid.' }, { status: 409 })
  }

  const pdf = await buildReceiptForPayment(paymentId)
  if (!pdf) return NextResponse.json({ error: 'Could not generate receipt' }, { status: 500 })

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdf.filename}"`,
    },
  })
}
