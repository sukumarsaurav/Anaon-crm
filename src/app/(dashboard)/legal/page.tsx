export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getLegalStats, getAllProjectsRERAStatus } from '@/lib/legal/queries'
import { Shield, AlertTriangle, CheckCircle2, XCircle, Clock, FileText, Lock, Building2 } from 'lucide-react'

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 55 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-8 text-right">{score}%</span>
    </div>
  )
}

function AlertBadge({ level }: { level: 'ok' | 'warning' | 'critical' }) {
  if (level === 'ok') return <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">OK</span>
  if (level === 'warning') return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">Warning</span>
  return <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full">Critical</span>
}

export default async function LegalPage() {
  const [stats, projects] = await Promise.all([
    getLegalStats(),
    getAllProjectsRERAStatus(),
  ])

  const criticalProjects = projects.filter(p => p.alertLevel === 'critical')
  const warningProjects  = projects.filter(p => p.alertLevel === 'warning')

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Legal & Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">RERA compliance, legal documents, and data privacy</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'RERA Registered', value: `${stats.reraRegistered}/${stats.totalProjects}`, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Expiring (60d)', value: stats.expiringSoon, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Expired', value: stats.expired, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Pending Deletions', value: stats.pendingDeletions, icon: Lock, color: 'text-purple-600', bg: 'bg-purple-50' },
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

      {/* Critical alerts */}
      {(criticalProjects.length > 0 || warningProjects.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="font-semibold text-red-800 text-sm">Compliance Alerts</p>
          </div>
          {criticalProjects.map(p => (
            <div key={p.projectId} className="flex items-center justify-between text-sm">
              <Link href={`/legal/${p.projectId}`} className="text-red-700 hover:underline font-medium">{p.projectName}</Link>
              <span className="text-red-600 text-xs">
                {p.daysUntilExpiry !== null && p.daysUntilExpiry <= 0
                  ? `RERA expired ${Math.abs(p.daysUntilExpiry)} days ago`
                  : !p.reraNumber ? 'No RERA number'
                  : 'Critical'}
              </span>
            </div>
          ))}
          {warningProjects.map(p => (
            <div key={p.projectId} className="flex items-center justify-between text-sm">
              <Link href={`/legal/${p.projectId}`} className="text-amber-700 hover:underline font-medium">{p.projectName}</Link>
              <span className="text-amber-600 text-xs">
                {p.daysUntilExpiry !== null && p.daysUntilExpiry <= 60 && p.daysUntilExpiry > 0
                  ? `RERA expiring in ${p.daysUntilExpiry} days`
                  : p.quarterlyReportDue ? 'Quarterly report overdue'
                  : 'Warning'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Quick navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/legal/documents" className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
          <FileText size={20} className="text-indigo-500 mb-3" />
          <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700">Legal Templates</p>
          <p className="text-xs text-slate-500 mt-1">{stats.totalTemplates} document templates — booking form, ATS, allotment letter</p>
        </Link>
        <Link href="/legal/privacy" className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
          <Lock size={20} className="text-purple-500 mb-3" />
          <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700">Data Privacy (DPDP)</p>
          <p className="text-xs text-slate-500 mt-1">{stats.pendingDeletions} pending deletion requests · consent management</p>
        </Link>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <Building2 size={20} className="text-green-500 mb-3" />
          <p className="font-semibold text-slate-900 text-sm">RERA Compliance</p>
          <p className="text-xs text-slate-500 mt-1">{stats.reraRegistered} of {stats.totalProjects} projects RERA-registered</p>
        </div>
      </div>

      {/* Per-project RERA table */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-3">Project RERA Status</h2>
        {projects.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl">
            <Shield size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No active projects found</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">RERA No.</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Expiry</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Docs</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map(p => (
                  <tr key={p.projectId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/legal/${p.projectId}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {p.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.reraNumber
                        ? <span className="font-mono text-xs text-slate-700">{p.reraNumber}</span>
                        : <span className="text-xs text-red-500">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {p.reraExpiryDate ? (
                        <span className={p.daysUntilExpiry !== null && p.daysUntilExpiry <= 60 ? 'text-red-600 font-medium' : ''}>
                          {p.reraExpiryDate}
                          {p.daysUntilExpiry !== null && (
                            <span className="ml-1 text-slate-400">
                              ({p.daysUntilExpiry <= 0 ? 'expired' : `${p.daysUntilExpiry}d`})
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        {[p.hasRERADoc, p.hasTitleDeed, p.hasLayoutApproval, p.hasFireNOC].map((has, i) => (
                          has
                            ? <CheckCircle2 key={i} size={12} className="text-green-500" />
                            : <XCircle key={i} size={12} className="text-slate-300" />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-28">
                      <ScoreBar score={p.complianceScore} />
                    </td>
                    <td className="px-4 py-3">
                      <AlertBadge level={p.alertLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
