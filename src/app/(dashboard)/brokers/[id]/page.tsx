export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBrokerById, getBrokerStats, getBrokerCommissions, getBrokerLeadRegistrations } from '@/lib/brokers/queries'
import { getProfile } from '@/lib/supabase/getProfile'
import { formatCurrency, formatDate } from '@/lib/utils'
import BrokerStatusBadge from '@/components/brokers/BrokerStatusBadge'
import BrokerPerformanceCard from '@/components/brokers/BrokerPerformanceCard'
import BrokerApprovalPanel from '@/components/brokers/BrokerApprovalPanel'
import { ArrowLeft, Edit, Phone, Mail, MapPin, Building, CreditCard } from 'lucide-react'
import { COMMISSION_STATUS_CONFIG } from '@/types/bookings'
import { LEAD_REG_STATUS_CONFIG } from '@/types/brokers'
import type { BrokerStatus } from '@/types/brokers'
import type { CommissionStatus } from '@/types/bookings'

interface PageProps {
  params: Promise<{ id: string }>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0 mr-4">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  )
}

export default async function BrokerDetailPage({ params }: PageProps) {
  const { id } = await params

  const [broker, stats, { commissions }, leads] = await Promise.all([
    getBrokerById(id),
    getBrokerStats(id),
    getBrokerCommissions({ broker_id: id, limit: 20 }),
    getBrokerLeadRegistrations(id),
  ])

  if (!broker) notFound()

  const profile = (await getProfile())?.profile
  const canManage = ['admin', 'manager'].includes(profile?.role ?? '')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/brokers" className="mt-1 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{broker.full_name}</h1>
              <BrokerStatusBadge status={broker.status as BrokerStatus} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {[broker.firm_name, broker.city].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {canManage && (
          <Link href={`/brokers/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
            <Edit size={14} /> Edit
          </Link>
        )}
      </div>

      {/* Approval panel */}
      {canManage && (broker.status === 'pending' || broker.status === 'approved') && (
        <BrokerApprovalPanel brokerId={id} status={broker.status} />
      )}

      {/* Performance */}
      <BrokerPerformanceCard stats={stats} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Profile</h3>
            <Row label="Full Name"   value={broker.full_name} />
            <Row label="Firm"        value={broker.firm_name} />
            <Row label="RERA"        value={broker.rera_number} />
            <Row label="GSTIN"       value={broker.gstin} />
            <Row label="Onboarded"   value={broker.onboarded_at ? formatDate(broker.onboarded_at) : null} />
            {broker.rejected_reason && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs text-red-700">
                Rejected: {broker.rejected_reason}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Contact</h3>
            {broker.phone && (
              <div className="flex items-center gap-2 text-sm py-1.5">
                <Phone size={14} className="text-slate-400" />
                <span>{broker.phone}</span>
              </div>
            )}
            {broker.email && (
              <div className="flex items-center gap-2 text-sm py-1.5">
                <Mail size={14} className="text-slate-400" />
                <span>{broker.email}</span>
              </div>
            )}
            {broker.city && (
              <div className="flex items-center gap-2 text-sm py-1.5">
                <MapPin size={14} className="text-slate-400" />
                <span>{broker.city}</span>
              </div>
            )}
            {broker.address && (
              <div className="flex items-start gap-2 text-sm py-1.5">
                <Building size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="text-slate-600">{broker.address}</span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Bank Details</h3>
            {[broker.bank_name, broker.account_number, broker.ifsc].some(Boolean) ? (
              <>
                <Row label="Bank"    value={broker.bank_name} />
                <Row label="Account" value={broker.account_number} />
                <Row label="IFSC"    value={broker.ifsc} />
              </>
            ) : (
              <p className="text-sm text-slate-400">No bank details on file</p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Commission Rate</h3>
            <p className="text-3xl font-bold text-indigo-600">{broker.commission_rate}%</p>
            <p className="text-xs text-slate-500 mt-1">Default rate per booking value</p>
          </div>
        </div>

        {/* Leads + Commissions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lead registrations */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Registered Leads</h3>
              <span className="text-xs text-slate-400">{leads.length} total</span>
            </div>
            {leads.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No leads registered yet</p>
            ) : (
              <div className="space-y-2">
                {leads.slice(0, 10).map((l) => {
                  const cfg = LEAD_REG_STATUS_CONFIG[l.status]
                  return (
                    <div key={l.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{l.client_name}</p>
                        <p className="text-xs text-slate-400">{l.client_phone} · {l.project?.name ?? 'No project'} · {formatDate(l.created_at)}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Commission history */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Commission History</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-amber-600">Pending: {formatCurrency(stats.commission_pending)}</span>
                <span className="text-green-600">Paid: {formatCurrency(stats.commission_paid)}</span>
              </div>
            </div>
            {commissions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No commissions yet</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="pb-2 text-left">Booking</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2 text-right">Commission</th>
                    <th className="pb-2 text-left pl-4">Status</th>
                    <th className="pb-2 text-left">UTR</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => {
                    const cfg = COMMISSION_STATUS_CONFIG[c.status as CommissionStatus]
                    return (
                      <tr key={c.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-600">{c.booking?.booking_number ?? '—'}</td>
                        <td className="py-2 text-right">{formatCurrency(c.booking_value)}</td>
                        <td className="py-2 text-right font-semibold text-indigo-700">{formatCurrency(c.commission_amount ?? 0)}</td>
                        <td className="py-2 pl-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>{cfg?.label}</span>
                        </td>
                        <td className="py-2 text-xs text-slate-400">{c.utr_number ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {broker.notes && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Internal Notes</p>
          <p className="text-sm text-slate-700">{broker.notes}</p>
        </div>
      )}
    </div>
  )
}
