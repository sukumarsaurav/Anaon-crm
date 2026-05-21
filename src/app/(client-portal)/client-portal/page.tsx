export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalSession, getPortalClientData } from '@/lib/portal/queries'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, FileText, Building2, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { COMPLAINT_STATUS_CONFIG } from '@/types/clients'

export default async function ClientPortalDashboard() {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const data = await getPortalClientData(session.client.id)
  const { booking, paymentSummary, complaints, constructionUpdates, documents } = data

  const openComplaints = complaints.filter((c) => c.status !== 'resolved').length
  const pendingDocs    = documents.filter((d) => d.status === 'pending').length
  const latestUpdate   = constructionUpdates[0]
  const progressPct    = paymentSummary.total_due > 0
    ? Math.round((paymentSummary.total_paid / paymentSummary.total_due) * 100)
    : 0

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {data.client.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your property portal</p>
      </div>

      {/* Property card */}
      {booking ? (
        <div className="bg-indigo-600 rounded-2xl p-5 text-white">
          <p className="text-indigo-200 text-xs font-medium mb-1">YOUR PROPERTY</p>
          <h2 className="text-xl font-bold">{booking.project?.name}</h2>
          <p className="text-indigo-200 text-sm mt-0.5">Plot {booking.plot?.plot_number} · {booking.plot?.type?.replace('_',' ')}</p>
          <div className="mt-4 pt-4 border-t border-indigo-500 flex justify-between text-sm">
            <div>
              <p className="text-indigo-300 text-xs">Total Value</p>
              <p className="font-bold text-base">{formatCurrency(booking.total_sale_value)}</p>
            </div>
            <div className="text-right">
              <p className="text-indigo-300 text-xs">Booking Date</p>
              <p className="font-bold text-base">{formatDate(booking.booking_date)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-2xl p-5 text-center text-slate-500 text-sm">
          No confirmed booking found. Contact ANON INDIA for assistance.
        </div>
      )}

      {/* Payment progress */}
      {booking && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Payment Progress</h3>
            <span className="text-sm font-bold text-indigo-600">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 mb-3">
            <div className="bg-indigo-600 h-3 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-xs text-slate-500">Paid</p>
              <p className="font-semibold text-green-700">{formatCurrency(paymentSummary.total_paid)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Outstanding</p>
              <p className="font-semibold text-amber-700">{formatCurrency(paymentSummary.outstanding)}</p>
            </div>
          </div>
          {paymentSummary.next_due_date && (
            <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
              paymentSummary.overdue_count > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <AlertCircle size={16} />
              <span>
                {paymentSummary.overdue_count > 0 ? `${paymentSummary.overdue_count} overdue · ` : ''}
                Next due: <strong>{formatCurrency(paymentSummary.next_due_amount ?? 0)}</strong> on {formatDate(paymentSummary.next_due_date)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/client-portal/construction"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300">
          <Building2 size={20} className="text-indigo-500 mb-2" />
          <p className="text-xs text-slate-500">Construction</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">
            {latestUpdate ? `${latestUpdate.percentage_complete}% complete` : 'No updates yet'}
          </p>
        </Link>
        <Link href="/client-portal/documents"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300">
          <FileText size={20} className="text-blue-500 mb-2" />
          <p className="text-xs text-slate-500">Documents</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">
            {pendingDocs > 0 ? `${pendingDocs} pending upload` : 'All up to date'}
          </p>
        </Link>
        <Link href="/client-portal/complaints"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300">
          <MessageSquare size={20} className={openComplaints > 0 ? 'text-red-500' : 'text-green-500'} />
          <p className="text-xs text-slate-500 mb-2">Complaints</p>
          <p className="text-sm font-semibold text-slate-900">
            {openComplaints > 0 ? `${openComplaints} open` : 'All resolved'}
          </p>
        </Link>
        <Link href="/client-portal/payments"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300">
          <CreditCard size={20} className="text-amber-500 mb-2" />
          <p className="text-xs text-slate-500">Payments</p>
          <p className="text-sm font-semibold text-slate-900">
            {paymentSummary.overdue_count > 0 ? `${paymentSummary.overdue_count} overdue` : 'View schedule'}
          </p>
        </Link>
      </div>

      {/* Latest construction update */}
      {latestUpdate && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-500" />
            <h3 className="font-semibold text-slate-900 text-sm">Latest Update</h3>
            <span className="ml-auto text-xs text-slate-400">{formatDate(latestUpdate.update_date)}</span>
          </div>
          <p className="text-sm font-medium text-slate-800">{latestUpdate.title}</p>
          {latestUpdate.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{latestUpdate.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full">
              <div className="h-2 bg-green-500 rounded-full" style={{ width: `${latestUpdate.percentage_complete}%` }} />
            </div>
            <span className="text-xs font-semibold text-green-700">{latestUpdate.percentage_complete}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
