import React from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { renderPdfBuffer, uploadPdf } from './render'
import { ReceiptDoc, AllotmentLetterDoc, DemandLetterDoc, PayslipDoc, type ReceiptData, type PayslipData } from './documents'
import { rupeesInWords } from '@/lib/hr/amountInWords'
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

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Payslip PDF. Generated on request and never stored, so it always matches the slip (and no copy of
 * salary data sits in a bucket). The caller checks who may see it.
 */
export async function buildPayslip(slipId: string): Promise<{ buffer: Buffer; filename: string; userId: string; runCompleted: boolean } | null> {
  const supabase = createServiceClient()
  const { data: slip } = await supabase
    .from('payroll_slips')
    .select('*, run:payroll_runs!payroll_slips_run_id_fkey(year, month, status), employee:profiles!payroll_slips_user_id_fkey(full_name, employee_id, designation, department, joining_date, pan_number, bank_name, bank_account, bank_ifsc)')
    .eq('id', slipId)
    .maybeSingle()
  if (!slip) return null
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  type Run = { year: number; month: number; status: string }
  const run = one<Run>(slip.run as Run | Run[] | null)
  type Emp = { full_name: string | null; employee_id: string | null; designation: string | null; department: string | null; joining_date: string | null; pan_number: string | null; bank_name: string | null; bank_account: string | null; bank_ifsc: string | null }
  const emp = one<Emp>(slip.employee as Emp | Emp[] | null)
  if (!run || !emp) return null

  const period = `${MONTHS[run.month]} ${run.year}`
  const data: PayslipData = {
    period,
    slip: {
      working_days: Number(slip.working_days), present_days: Number(slip.present_days), lop_days: Number(slip.lop_days),
      basic: Number(slip.basic), hra: Number(slip.hra), allowances: Number(slip.allowances), incentives: Number(slip.incentives ?? 0),
      gross: Number(slip.gross), pf_employee: Number(slip.pf_employee), professional_tax: Number(slip.professional_tax),
      tds: slip.tds != null ? Number(slip.tds) : null, total_deductions: Number(slip.total_deductions), net_pay: Number(slip.net_pay),
    },
    employee: {
      full_name: emp.full_name ?? '', employee_id: emp.employee_id, designation: emp.designation, department: emp.department,
      joining_date: emp.joining_date, pan: emp.pan_number, bank_name: emp.bank_name, bank_account: emp.bank_account, bank_ifsc: emp.bank_ifsc,
    },
    netInWords: rupeesInWords(Number(slip.net_pay)),
  }
  const buffer = await renderPdfBuffer(React.createElement(PayslipDoc, { data }))
  const safeName = (emp.employee_id || emp.full_name || 'employee').replace(/[^\w-]+/g, '_')
  return { buffer, filename: `Payslip-${safeName}-${run.year}-${String(run.month).padStart(2, '0')}.pdf`, userId: slip.user_id, runCompleted: run.status === 'completed' }
}
