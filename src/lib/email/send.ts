import { todayIST } from '@/lib/datetime'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, emailConfigured } from './client'
import { receiptEmail } from './templates'
import { buildReceiptForPayment } from '@/lib/pdf/builders'

function inr(n: number | null | undefined): string {
  if (n == null) return '—'
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

/**
 * Email a payment receipt (with PDF attachment) to the client.
 * Safe to call from webhook/server-action contexts — uses the service client
 * and never throws (failures are logged, not propagated).
 */
export async function sendReceiptEmail(paymentId: string): Promise<void> {
  try {
    if (!emailConfigured()) return

    const supabase = createServiceClient()
    const { data: payment } = await supabase
      .from('payments')
      .select('id, installment_number, amount_paid, paid_date, mode, transaction_id, razorpay_payment_id, payment_reference, booking_id, client_id')
      .eq('id', paymentId)
      .single()
    if (!payment) return

    const { data: client } = await supabase
      .from('clients').select('full_name, email').eq('id', payment.client_id).single()
    if (!client?.email) return // nothing to email to

    const { data: booking } = await supabase
      .from('bookings').select('booking_number').eq('id', payment.booking_id).single()

    const pdf = await buildReceiptForPayment(paymentId)
    if (!pdf) return

    const ref = payment.razorpay_payment_id ?? payment.transaction_id ?? payment.payment_reference ?? payment.id.slice(0, 8)
    const tpl = receiptEmail({
      name: client.full_name,
      bookingNumber: booking?.booking_number ?? '—',
      installment: payment.installment_number,
      amount: inr(payment.amount_paid),
      date: payment.paid_date ?? todayIST(),
      reference: ref,
    })

    await sendEmail({
      to: client.email,
      subject: tpl.subject,
      html: tpl.html,
      attachments: [{ filename: pdf.filename, content: pdf.buffer }],
    })
  } catch (e) {
    console.error('[email] sendReceiptEmail failed:', e)
  }
}
