import React from 'react'
import { displayPii } from '@/lib/security/pii'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { AllotmentLetterData, DemandLetterData } from '@/types/bookings'
import type { Payment } from '@/types/clients'
import type { BookingFull } from '@/types/bookings'

// ── Shared formatting ─────────────────────────────────────────────
function inr(n: number | null | undefined): string {
  if (n == null) return '—'
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

const C = { ink: '#1e293b', muted: '#64748b', line: '#e2e8f0', gold: '#a87e26' }

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: C.ink, fontFamily: 'Helvetica', lineHeight: 1.5 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: C.ink, paddingBottom: 10, marginBottom: 18 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  brandSub: { fontSize: 8, color: C.muted, marginTop: 2 },
  docMeta: { fontSize: 8, color: C.muted, textAlign: 'right' },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: '38%', color: C.muted },
  value: { width: '62%', fontFamily: 'Helvetica-Bold' },
  para: { marginBottom: 8, textAlign: 'justify' },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 2 },
  trHead: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: C.line },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  th: { padding: 6, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  td: { padding: 6, fontSize: 9 },
  totalRow: { flexDirection: 'row', backgroundColor: '#fbf7ee' },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, fontSize: 7.5, color: C.muted, flexDirection: 'row', justifyContent: 'space-between' },
  signBlock: { marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' },
  signBox: { width: '40%' },
  signLine: { borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4, fontSize: 8, color: C.muted },
})

function Brand({ docLabel, docNo }: { docLabel: string; docNo: string }) {
  return (
    <View style={s.brandRow}>
      <View>
        <Text style={s.brand}>ANON INDIA</Text>
        <Text style={s.brandSub}>Real Estate · Jaipur, Rajasthan</Text>
      </View>
      <View>
        <Text style={[s.docMeta, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>{docLabel}</Text>
        <Text style={s.docMeta}>Ref: {docNo}</Text>
        <Text style={s.docMeta}>Date: {fmtDate(new Date().toISOString())}</Text>
      </View>
    </View>
  )
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>ANON INDIA · This is a computer-generated document.</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  )
}

// ── Allotment Letter ──────────────────────────────────────────────
export function AllotmentLetterDoc({ data }: { data: AllotmentLetterData }) {
  const b = data.booking
  const size = b.plot?.size_sqyd ? `${b.plot.size_sqyd} sq.yd` : b.plot?.size_sqft ? `${b.plot.size_sqft} sq.ft` : '—'
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Brand docLabel="ALLOTMENT LETTER" docNo={b.booking_number} />
        <Text style={s.title}>Letter of Allotment</Text>

        <View style={s.section}>
          <Text style={s.para}>Dear {b.client?.full_name ?? 'Applicant'},</Text>
          <Text style={s.para}>
            We are pleased to confirm the allotment of the unit detailed below in the project
            “{b.project?.name ?? '—'}”. This allotment is subject to the terms of your booking and the
            applicable sale agreement.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Allottee</Text>
          <KV label="Name" value={b.client?.full_name ?? '—'} />
          <KV label="Phone" value={b.client?.phone ?? '—'} />
          <KV label="PAN" value={displayPii(b.client?.pan_encrypted) || '—'} />
          <KV label="Address" value={b.client?.permanent_address ?? '—'} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Unit</Text>
          <KV label="Project" value={`${b.project?.name ?? '—'}${b.project?.city ? `, ${b.project.city}` : ''}`} />
          <KV label="RERA No." value={b.project?.rera_number ?? '—'} />
          <KV label="Plot / Unit" value={b.plot?.plot_number ?? '—'} />
          <KV label="Size" value={size} />
          <KV label="Facing" value={b.plot?.facing ?? '—'} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Commercials</Text>
          <KV label="Total Sale Value" value={inr(b.total_sale_value)} />
          <KV label="Booking Amount" value={inr(b.booking_amount)} />
          <KV label="Payment Plan" value={b.payment_plan_type ?? '—'} />
          <KV label="Booking Date" value={fmtDate(b.booking_date)} />
          <KV label="Expected Possession" value={fmtDate(b.expected_possession_date)} />
        </View>

        <View style={s.signBlock}>
          <View style={s.signBox}><Text style={s.signLine}>Allottee Signature</Text></View>
          <View style={s.signBox}><Text style={s.signLine}>For ANON INDIA (Authorised Signatory)</Text></View>
        </View>
        <Footer />
      </Page>
    </Document>
  )
}

// ── Demand Letter ─────────────────────────────────────────────────
export function DemandLetterDoc({ data }: { data: DemandLetterData }) {
  const b = data.booking
  const p = data.payment
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Brand docLabel="DEMAND LETTER" docNo={`${b.booking_number}-I${p.installment_number}`} />
        <Text style={s.title}>Payment Demand Notice</Text>

        <Text style={s.para}>Dear {b.client?.full_name ?? 'Applicant'},</Text>
        <Text style={s.para}>
          As per the agreed payment schedule for unit {b.plot?.plot_number ?? '—'} in
          “{b.project?.name ?? '—'}”, the following installment is now due. Kindly remit the amount on or
          before the due date to avoid late charges.
        </Text>

        <View style={[s.table, s.section]}>
          <View style={s.trHead}>
            <Text style={[s.th, { width: '12%' }]}>#</Text>
            <Text style={[s.th, { width: '48%' }]}>Description</Text>
            <Text style={[s.th, { width: '20%' }]}>Due Date</Text>
            <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>Amount</Text>
          </View>
          <View style={s.tr}>
            <Text style={[s.td, { width: '12%' }]}>{p.installment_number}</Text>
            <Text style={[s.td, { width: '48%' }]}>{p.description ?? 'Installment'}</Text>
            <Text style={[s.td, { width: '20%' }]}>{fmtDate(p.due_date)}</Text>
            <Text style={[s.td, { width: '20%', textAlign: 'right' }]}>{inr(p.amount_due)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={[s.td, { width: '80%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Total Payable</Text>
            <Text style={[s.td, { width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{inr(p.amount_due)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Remittance Details</Text>
          <KV label="Account Name" value={data.bank_name} />
          <KV label="Account Number" value={data.account_number} />
          <KV label="IFSC" value={data.ifsc} />
          <Text style={[s.para, { marginTop: 6, color: C.muted }]}>
            Late payment beyond the due date attracts a charge of {(data.late_charge_pct * 100).toFixed(1)}% per annum on the
            outstanding amount. You may also pay online via your ANON INDIA Client Portal.
          </Text>
        </View>

        <View style={s.signBlock}>
          <View style={s.signBox} />
          <View style={s.signBox}><Text style={s.signLine}>For ANON INDIA (Accounts)</Text></View>
        </View>
        <Footer />
      </Page>
    </Document>
  )
}

// ── Payment Receipt ───────────────────────────────────────────────
export interface ReceiptData {
  payment: Payment
  booking: Pick<BookingFull, 'booking_number'> & {
    client?: { full_name: string; phone: string } | null
    project?: { name: string } | null
    plot?: { plot_number: string } | null
  }
}

export function ReceiptDoc({ data }: { data: ReceiptData }) {
  const p = data.payment
  const b = data.booking
  const ref = p.razorpay_payment_id ?? p.transaction_id ?? p.payment_reference ?? p.id.slice(0, 8)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Brand docLabel="PAYMENT RECEIPT" docNo={`RCPT-${b.booking_number}-${p.installment_number}`} />
        <Text style={s.title}>Payment Receipt</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Received From</Text>
          <KV label="Name" value={b.client?.full_name ?? '—'} />
          <KV label="Phone" value={b.client?.phone ?? '—'} />
          <KV label="Project / Unit" value={`${b.project?.name ?? '—'} · ${b.plot?.plot_number ?? '—'}`} />
          <KV label="Booking" value={b.booking_number} />
        </View>

        <View style={[s.table, s.section]}>
          <View style={s.trHead}>
            <Text style={[s.th, { width: '60%' }]}>Particulars</Text>
            <Text style={[s.th, { width: '40%', textAlign: 'right' }]}>Amount</Text>
          </View>
          <View style={s.tr}>
            <Text style={[s.td, { width: '60%' }]}>
              Installment #{p.installment_number}{p.description ? ` — ${p.description}` : ''}
            </Text>
            <Text style={[s.td, { width: '40%', textAlign: 'right' }]}>{inr(p.amount_paid)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={[s.td, { width: '60%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Amount Received</Text>
            <Text style={[s.td, { width: '40%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{inr(p.amount_paid)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Transaction</Text>
          <KV label="Date" value={fmtDate(p.paid_date)} />
          <KV label="Mode" value={p.mode ?? '—'} />
          <KV label="Reference" value={ref} />
          <KV label="Status" value="PAID" />
        </View>

        <Text style={[s.para, { marginTop: 20, color: C.muted }]}>
          This receipt acknowledges the amount received against the above installment. For any discrepancy,
          please contact ANON INDIA accounts within 7 days.
        </Text>
        <Footer />
      </Page>
    </Document>
  )
}
