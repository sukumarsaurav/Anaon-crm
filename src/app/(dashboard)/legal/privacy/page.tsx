export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getDataDeletionRequests, getPrivacyStats, getConsentStats } from '@/lib/legal/queries'
import { DELETION_STATUS_CONFIG, CONSENT_TYPES } from '@/types/legal'
import DeletionRequestActions from '@/components/legal/DeletionRequestActions'
import NewDeletionRequestForm from '@/components/legal/NewDeletionRequestForm'
import { ChevronLeft, Lock, UserX, ShieldCheck, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function PrivacyCompliancePage() {
  const [requests, stats, consentStats] = await Promise.all([
    getDataDeletionRequests(),
    getPrivacyStats(),
    getConsentStats(),
  ])

  const pending   = requests.filter(r => r.status === 'pending')
  const active    = requests.filter(r => r.status === 'in_progress')
  const completed = requests.filter(r => ['completed', 'rejected'].includes(r.status))

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/legal" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Privacy Compliance</h1>
            <p className="text-sm text-slate-500 mt-0.5">DPDP Act 2023 — consent management and data deletion requests</p>
          </div>
        </div>
        <NewDeletionRequestForm />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Requests', value: stats.pendingRequests, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: stats.completedRequests, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Consent Logs', value: stats.totalConsentLogs, icon: Lock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Opted Out', value: stats.optedOut, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon size={15} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Consent breakdown */}
      {Object.keys(consentStats).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Consent Breakdown</h2>
          <div className="space-y-3">
            {CONSENT_TYPES.map(({ value, label }) => {
              const stat = consentStats[value]
              if (!stat) return null
              const pct = stat.total > 0 ? Math.round((stat.opted_in / stat.total) * 100) : 0
              return (
                <div key={value}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700">{label}</span>
                    <span className="text-slate-500 text-xs">{stat.opted_in}/{stat.total} opted in ({pct}%)</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Pending Requests ({pending.length})
          </h2>
          <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pending.map(req => (
                <RequestRow key={req.id} req={req} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-progress requests */}
      {active.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            In Progress ({active.length})
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {active.map(req => (
                <RequestRow key={req.id} req={req} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Completed / Rejected</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {completed.slice(0, 20).map(req => (
                <RequestRow key={req.id} req={req} />
              ))}
            </div>
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <Lock size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No data deletion requests</p>
          <p className="text-xs text-slate-400 mt-1">Requests will appear here when leads or clients request data deletion</p>
        </div>
      )}

      {/* DPDP compliance notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">DPDP Act 2023 — Key Obligations</p>
        <ul className="text-xs space-y-1 text-blue-700 list-disc list-inside">
          <li>Data deletion requests must be honored within 30 days</li>
          <li>Collect only data necessary for the stated purpose (data minimisation)</li>
          <li>Obtain explicit consent before processing personal data</li>
          <li>PAN / Aadhaar numbers must be encrypted at rest (configured at DB level)</li>
          <li>WhatsApp opt-outs mandatory per TRAI regulations (managed in WhatsApp module)</li>
        </ul>
      </div>
    </div>
  )
}

function RequestRow({ req }: { req: any }) {
  const cfg = DELETION_STATUS_CONFIG[req.status as keyof typeof DELETION_STATUS_CONFIG]
  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-semibold text-slate-900 text-sm">{req.requester_name}</p>
            <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{req.requester_type}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-slate-500">
            {req.requester_phone && `${req.requester_phone} · `}
            {req.requester_email && `${req.requester_email} · `}
            Requested {formatDate(req.requested_at)}
          </p>
          {req.reason && <p className="text-xs text-slate-600 mt-1 italic">"{req.reason}"</p>}
          {req.admin_notes && <p className="text-xs text-slate-500 mt-1">Notes: {req.admin_notes}</p>}
          {req.completed_at && <p className="text-xs text-green-600 mt-1">Completed {formatDate(req.completed_at)}</p>}
        </div>
      </div>
      <DeletionRequestActions id={req.id} currentStatus={req.status} />
    </div>
  )
}
