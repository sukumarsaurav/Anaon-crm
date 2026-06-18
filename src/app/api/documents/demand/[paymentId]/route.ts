import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { buildDemandForPayment } from '@/lib/pdf/builders'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const user = (await getProfile())?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentId } = await params
  const pdf = await buildDemandForPayment(paymentId)
  if (!pdf) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdf.filename}"`,
    },
  })
}
