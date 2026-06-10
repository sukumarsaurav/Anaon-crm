export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getBookingById, getBookingPayments, getBookingCommission } from '@/lib/bookings/queries'
import { getProfile } from '@/lib/supabase/getProfile'
import { formatCurrency, formatDate } from '@/lib/utils'
import BookingStatusBadge from '@/components/bookings/BookingStatusBadge'
import ApprovalPanel from '@/components/bookings/ApprovalPanel'
import PaymentPlanBuilder from '@/components/bookings/PaymentPlanBuilder'
import { PAYMENT_PLAN_LABELS, REFERRED_BY_LABELS, COMMISSION_STATUS_CONFIG } from '@/types/bookings'
import { FileText, AlertTriangle, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Alert from '@/components/ui/Alert'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0 mr-4">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  )
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params

  const [booking, payments, commission] = await Promise.all([
    getBookingById(id),
    getBookingPayments(id),
    getBookingCommission(id),
  ])
  if (!booking) notFound()

  const profile = (await getProfile())?.profile
  const canManage = ['admin', 'manager'].includes(profile?.role ?? '')

  const paidTotal    = payments.reduce((s, p) => s + (p.amount_paid ?? 0), 0)
  const pendingTotal = payments.reduce((s, p) => p.status === 'pending' ? s + p.amount_due : s, 0)
  const overdueCount = payments.filter((p) => p.status === 'pending' && p.due_date < new Date().toISOString().split('T')[0]).length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref="/bookings"
        title={<>{booking.booking_number}<BookingStatusBadge status={booking.status} /></>}
        subtitle={`${booking.client?.full_name} · ${booking.project?.name} · Plot ${booking.plot?.plot_number}`}
        actions={
          <>
            {booking.status === 'confirmed' && (
              <Button
                href={`/bookings/${id}/allotment-letter`}
                external
                variant="secondary"
                size="sm"
              >
                <FileText size={16} /> Allotment Letter
              </Button>
            )}
            {canManage && booking.status === 'confirmed' && (
              <Button href={`/bookings/${id}/cancel`} variant="danger" size="sm">
                <AlertTriangle size={16} /> Cancel
              </Button>
            )}
          </>
        }
      />

      {/* Approval panel */}
      {booking.status === 'pending_approval' && canManage && (
        <ApprovalPanel bookingId={id} />
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — booking + plot details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Booking details */}
          <Card padding="md">
            <h3 className="font-semibold text-slate-900 mb-3">Booking Details</h3>
            <Row label="Client"            value={booking.client?.full_name} />
            <Row label="Phone"             value={booking.client?.phone} />
            <Row label="PAN"               value={booking.client?.pan_encrypted} />
            <Row label="Project"           value={booking.project?.name} />
            <Row label="RERA"              value={booking.project?.rera_number} />
            <Row label="Plot"              value={`${booking.plot?.plot_number} · ${booking.plot?.type?.replace('_',' ')}`} />
            <Row label="Area"              value={booking.plot?.size_sqyd ? `${booking.plot.size_sqyd} sq yd` : booking.plot?.size_sqft ? `${booking.plot.size_sqft} sq ft` : null} />
            <Row label="Facing"            value={booking.plot?.facing?.replace('_','-').toUpperCase()} />
            <Row label="Booking Date"      value={formatDate(booking.booking_date)} />
            <Row label="Agreement Date"    value={booking.agreement_date ? formatDate(booking.agreement_date) : null} />
            <Row label="Possession Date"   value={booking.expected_possession_date ? formatDate(booking.expected_possession_date) : null} />
            <Row label="Payment Plan"      value={
              booking.payment_plan_type
                ? PAYMENT_PLAN_LABELS[booking.payment_plan_type] + (booking.payment_plan ? ` — ${booking.payment_plan}` : '')
                : booking.payment_plan
            } />
            <Row label="Lead Source"       value={booking.referred_by_source ? REFERRED_BY_LABELS[booking.referred_by_source] : null} />
            <Row label="Advisor"           value={booking.advisor?.full_name} />
            {booking.status === 'confirmed' && booking.approver && (
              <Row label="Approved By"     value={`${booking.approver.full_name} on ${formatDate(booking.approved_at!)}`} />
            )}
            {booking.approval_notes && <Row label="Approval Notes" value={booking.approval_notes} />}
          </Card>

          {/* Financial summary */}
          <Card padding="md">
            <h3 className="font-semibold text-slate-900 mb-3">Financial Summary</h3>
            <Row label="Total Sale Value"   value={formatCurrency(booking.total_sale_value)} />
            <Row label="Booking Amount"     value={formatCurrency(booking.booking_amount)} />
            <Row label="Total Received"     value={<span className="text-emerald-700">{formatCurrency(paidTotal)}</span>} />
            <Row label="Pending Installments" value={pendingTotal > 0 ? <span className="text-amber-700">{formatCurrency(pendingTotal)}</span> : null} />
            {overdueCount > 0 && (
              <Row label="Overdue" value={<span className="text-red-600">{overdueCount} installment{overdueCount > 1 ? 's' : ''}</span>} />
            )}
          </Card>

          {/* Broker commission */}
          {booking.broker && (
            <Card padding="md">
              <h3 className="font-semibold text-slate-900 mb-3">Broker Commission</h3>
              <Row label="Broker"           value={`${booking.broker.full_name}${booking.broker.firm_name ? ` (${booking.broker.firm_name})` : ''}`} />
              <Row label="Commission %"     value={`${booking.broker_commission_pct ?? booking.broker.commission_rate}%`} />
              <Row label="Commission Amount" value={formatCurrency(booking.broker_commission_amount ?? 0)} />
              {commission && (
                <>
                  <Row label="Status" value={
                    <StatusBadge config={COMMISSION_STATUS_CONFIG[commission.status as keyof typeof COMMISSION_STATUS_CONFIG]} />
                  } />
                  {commission.paid_at && <Row label="Paid On" value={formatDate(commission.paid_at)} />}
                  {commission.utr_number && <Row label="UTR" value={commission.utr_number} />}
                </>
              )}
            </Card>
          )}

          {/* Documents */}
          <Card padding="md">
            <h3 className="font-semibold text-slate-900 mb-3">Documents</h3>
            <div className="space-y-2">
              {[
                { label: 'Allotment Letter', url: booking.allotment_letter_url, sentAt: booking.allotment_letter_sent_at },
                { label: 'Agreement',        url: booking.agreement_url,        sentAt: null },
                { label: 'Booking Form',     url: booking.booking_form_url,     sentAt: null },
              ].map((doc) => (
                <div key={doc.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-600">{doc.label}</span>
                  {doc.url ? (
                    <div className="flex items-center gap-2">
                      {doc.sentAt && <span className="text-xs text-emerald-600">Sent {formatDate(doc.sentAt)}</span>}
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-indigo-600">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Not uploaded</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right — payment schedule */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Payment Schedule</h3>
            <Link
              href={`/clients/${booking.client_id}/bookings/${id}/payments`}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Full view →
            </Link>
          </div>
          <PaymentPlanBuilder
            bookingId={id}
            clientId={booking.client_id}
            totalValue={booking.total_sale_value}
            payments={payments}
            canManage={canManage}
          />
        </Card>
      </div>

      {/* Cancellation info */}
      {booking.status === 'cancelled' && (
        <Alert variant="error" title="Booking Cancelled">
          <strong>Date:</strong> {formatDate(booking.cancellation_date!)} &nbsp;|&nbsp;
          <strong>Reason:</strong> {booking.cancellation_reason}
          {booking.cancellation_charges ? ` · Charges: ${formatCurrency(booking.cancellation_charges)}` : ''}
        </Alert>
      )}
    </div>
  )
}
