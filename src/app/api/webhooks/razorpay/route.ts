import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyWebhookSignature } from '@/lib/payments/razorpay'
import { fireAutomations } from '@/lib/automation/engine'
import { sendReceiptEmail } from '@/lib/email/send'

/**
 * Razorpay webhook — the source of truth for marking installments paid.
 * Verifies the HMAC signature over the raw body, is idempotent on the
 * razorpay_payment_id, and fires the `payment_received` automation.
 *
 * Configure the same secret in Razorpay Dashboard → Webhooks as
 * RAZORPAY_WEBHOOK_SECRET, subscribed to `payment.captured`.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event?.event !== 'payment.captured') {
    return NextResponse.json({ status: 'ignored' })
  }

  const entity = event?.payload?.payment?.entity
  const orderId = entity?.order_id as string | undefined
  const paymentRefId = entity?.id as string | undefined
  if (!orderId || !paymentRefId) {
    return NextResponse.json({ status: 'ignored' })
  }

  const supabase = createServiceClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('id, client_id, booking_id, amount_due, status, razorpay_payment_id')
    .eq('razorpay_order_id', orderId)
    .single()

  if (!payment) return NextResponse.json({ status: 'no_matching_payment' })

  // Idempotent: already settled by this (or any) capture → no-op.
  if (payment.status === 'paid' && payment.razorpay_payment_id) {
    return NextResponse.json({ status: 'already_processed' })
  }

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('payments')
    .update({
      status:              'paid',
      amount_paid:         payment.amount_due,
      paid_date:           nowIso.split('T')[0],
      mode:                'online',
      razorpay_payment_id: paymentRefId,
      transaction_id:      paymentRefId,
      payment_reference:   `razorpay:${orderId}`,
      verified_at:         nowIso,
      updated_at:          nowIso,
    })
    .eq('id', payment.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (payment.client_id) {
    const { data: client } = await supabase
      .from('clients').select('full_name, phone').eq('id', payment.client_id).single()
    fireAutomations('payment_received', {
      payment: { id: payment.id, amount_due: payment.amount_due },
      client: client
        ? { id: payment.client_id, full_name: client.full_name, phone: client.phone }
        : undefined,
    }, 'payment', payment.id)
  }

  // Email the receipt with PDF attachment (no-op if email unconfigured / no client email).
  await sendReceiptEmail(payment.id)

  return NextResponse.json({ status: 'ok' })
}
