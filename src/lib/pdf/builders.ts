import React from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { renderPdfBuffer, uploadPdf } from './render'
import { ReceiptDoc, AllotmentLetterDoc, DemandLetterDoc, type ReceiptData } from './documents'
import type { AllotmentLetterData, DemandLetterData, BookingFull } from '@/types/bookings'
import type { Payment } from '@/types/clients'

const BOOKING_SELECT = `
  *,
  client:clients!bookings_client_id_fkey(id, full_name, phone, email, pan_encrypted, permanent_address),
  plot:plots!bookings_plot_id_fkey(id, plot_number, size_sqyd, size_sqft, facing, type, base_price, total_price),
  project:projects!bookings_project_id_fkey(id, name, city, type, rera_number, address)
`

export interface BuiltPdf {
  buffer: Buffer
  url: string
  filename: string
}

/** Receipt for a paid installment. Persists payments.receipt_url. */
export async function buildReceiptForPayment(paymentId: string): Promise<BuiltPdf | null> {
  const supabase = createServiceClient()
  const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).single()
  if (!payment) return null

  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_number, client:clients!bookings_client_id_fkey(full_name, phone), project:projects!bookings_project_id_fkey(name), plot:plots!bookings_plot_id_fkey(plot_number)')
    .eq('id', payment.booking_id)
    .single()
  if (!booking) return null

  // Supabase types embedded to-one joins as arrays; normalize to objects.
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  const b = booking as any
  const data: ReceiptData = {
    payment: payment as Payment,
    booking: {
      booking_number: b.booking_number,
      client: one(b.client),
      project: one(b.project),
      plot: one(b.plot),
    },
  }
  const buffer = await renderPdfBuffer(React.createElement(ReceiptDoc, { data }))
  const filename = `Receipt-${b.booking_number}-${payment.installment_number}.pdf`
  const url = await uploadPdf(`receipts/${paymentId}.pdf`, buffer)

  await supabase.from('payments').update({ receipt_url: url }).eq('id', paymentId)
  return { buffer, url, filename }
}

/** Allotment letter for a booking. Persists bookings.allotment_letter_url. */
export async function buildAllotmentForBooking(bookingId: string): Promise<BuiltPdf | null> {
  const supabase = createServiceClient()
  const { data: booking } = await supabase.from('bookings').select(BOOKING_SELECT).eq('id', bookingId).single()
  if (!booking) return null

  const data: AllotmentLetterData = { booking: booking as BookingFull, generated_at: new Date().toISOString() }
  const buffer = await renderPdfBuffer(React.createElement(AllotmentLetterDoc, { data }))
  const filename = `Allotment-${(booking as any).booking_number}.pdf`
  const url = await uploadPdf(`allotment/${bookingId}.pdf`, buffer)

  await supabase.from('bookings').update({ allotment_letter_url: url }).eq('id', bookingId)
  return { buffer, url, filename }
}

/** Demand letter for an installment. */
export async function buildDemandForPayment(paymentId: string): Promise<BuiltPdf | null> {
  const supabase = createServiceClient()
  const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).single()
  if (!payment) return null
  const { data: booking } = await supabase.from('bookings').select(BOOKING_SELECT).eq('id', payment.booking_id).single()
  if (!booking) return null

  const data: DemandLetterData = {
    booking: booking as BookingFull,
    payment: payment as Payment,
    generated_at: new Date().toISOString(),
    bank_name: 'ANON INDIA — Collection Account',
    account_number: 'XXXXXXXXXXXX',
    ifsc: 'XXXX0000000',
    late_charge_pct: 0.05,
  }
  const buffer = await renderPdfBuffer(React.createElement(DemandLetterDoc, { data }))
  const filename = `Demand-${(booking as any).booking_number}-I${payment.installment_number}.pdf`
  const url = await uploadPdf(`demand/${paymentId}.pdf`, buffer)
  return { buffer, url, filename }
}
