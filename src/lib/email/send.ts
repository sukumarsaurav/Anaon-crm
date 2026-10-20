import { todayIST } from '@/lib/datetime'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, emailConfigured } from './client'
import { receiptEmail, bookingConfirmationEmail, demandEmail } from './templates'
import { buildReceiptForPayment, buildAllotmentForBooking, buildDemandForPayment } from '@/lib/pdf/builders'

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

/**
 * Email the allotment letter PDF for a confirmed booking. Unlike the receipt this reports back: the
 * caller records "sent" only when the email actually went out.
 */
export async function sendAllotmentEmail(bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!emailConfigured()) return { success: false, error: 'Email is not configured (RESEND_API_KEY / EMAIL_FROM)' }
    const supabase = createServiceClient()
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_number, status, total_sale_value, client:clients!bookings_client_id_fkey(full_name, email), project:projects!bookings_project_id_fkey(name), plot:plots!bookings_plot_id_fkey(plot_number)')
      .eq('id', bookingId)
      .single()
    if (!booking) return { success: false, error: 'Booking not found' }
    if (booking.status !== 'confirmed') return { success: false, error: 'Only a confirmed booking has an allotment letter' }
    const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
    const client = one(booking.client as unknown as { full_name: string; email: string | null } | null)
    if (!client?.email) return { success: false, error: 'The client has no email address' }

    const pdf = await buildAllotmentForBooking(bookingId)
    if (!pdf) return { success: false, error: 'Could not generate the allotment letter' }

    const tpl = bookingConfirmationEmail({
      name: client.full_name,
      bookingNumber: booking.booking_number,
      project: one(booking.project as unknown as { name: string } | null)?.name ?? '—',
      unit: `Plot ${one(booking.plot as unknown as { plot_number: string } | null)?.plot_number ?? '—'}`,
      totalValue: inr(booking.total_sale_value),
    })
    const sent = await sendEmail({
      to: client.email,
      subject: `Allotment Letter · ${booking.booking_number}`,
      html: tpl.html,
      attachments: [{ filename: pdf.filename, content: pdf.buffer }],
    })
    return sent.success ? { success: true } : { success: false, error: sent.error ?? 'Email failed' }
  } catch (e) {
    console.error('[email] sendAllotmentEmail failed:', e)
    return { success: false, error: (e as Error).message }
  }
}

/** Email the demand letter for an installment (construction milestone reached). Never throws. */
export async function sendDemandEmail(paymentId: string): Promise<void> {
  try {
    if (!emailConfigured()) return
    const supabase = createServiceClient()
    const { data: payment } = await supabase
      .from('payments').select('installment_number, amount_due, amount_paid, due_date, booking_id, client_id').eq('id', paymentId).single()
    if (!payment) return
    const { data: client } = await supabase.from('clients').select('full_name, email').eq('id', payment.client_id).single()
    if (!client?.email) return
    const { data: booking } = await supabase.from('bookings').select('booking_number').eq('id', payment.booking_id).single()
    const pdf = await buildDemandForPayment(paymentId)
    const tpl = demandEmail({
      name: client.full_name,
      bookingNumber: booking?.booking_number ?? '—',
      installment: payment.installment_number,
      amount: inr(Number(payment.amount_due ?? 0) - Number(payment.amount_paid ?? 0)),
      dueDate: payment.due_date,
      portalUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/client-portal/payments` : undefined,
    })
    await sendEmail({ to: client.email, subject: tpl.subject, html: tpl.html, attachments: pdf ? [{ filename: pdf.filename, content: pdf.buffer }] : [] })
  } catch (e) {
    console.error('[email] sendDemandEmail failed:', e)
  }
}
