import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal/session'
import { createServiceClient } from '@/lib/supabase/service'
import { createOrder, razorpayConfigured } from '@/lib/payments/razorpay'

/**
 * Create a Razorpay order for an outstanding installment.
 * Authenticated via the client-portal session cookie (not Supabase auth).
 * Source of truth for "paid" is the webhook — this only opens the order.
 */
export async function POST(req: NextRequest) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: 'Online payment is not available right now.' }, { status: 503 })
  }

  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let paymentId: string
  try {
    ;({ paymentId } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('id, client_id, amount_due, amount_paid, status, installment_number, booking_id')
    .eq('id', paymentId)
    .single()

  if (!payment || payment.client_id !== session.client.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }
  if (payment.status === 'paid' || payment.status === 'waived') {
    return NextResponse.json({ error: 'This installment is already settled.' }, { status: 409 })
  }

  const outstanding = Number(payment.amount_due) - Number(payment.amount_paid ?? 0)
  if (outstanding <= 0) {
    return NextResponse.json({ error: 'Nothing left to pay on this installment.' }, { status: 409 })
  }

  let order
  try {
    order = await createOrder({
      amountInRupees: outstanding,
      receipt: `pay_${payment.id}`,
      notes: { payment_id: payment.id, client_id: payment.client_id, booking_id: payment.booking_id ?? '' },
    })
  } catch (err) {
    return NextResponse.json({ error: `Could not start payment: ${String(err)}` }, { status: 502 })
  }

  await supabase
    .from('payments')
    .update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() })
    .eq('id', payment.id)

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    name: 'ANON INDIA',
    description: `Installment #${payment.installment_number}`,
    prefill: { name: session.client.full_name, email: session.client.email ?? '', contact: session.client.phone },
  })
}
