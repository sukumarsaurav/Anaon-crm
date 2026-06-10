'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Phone, MessageSquare, UserCog, AlertTriangle } from 'lucide-react'
import type { Lead } from '@/types/leads'
import StageBadge from './StageBadge'
import AssignModal from './AssignModal'
import { formatPhone, getInitials, cn } from '@/lib/utils'

interface OverdueLeadsTableProps {
  leads: Lead[]
  advisors: { id: string; full_name: string; role: string }[]
}

function daysOverdue(dateIso: string | null): number {
  if (!dateIso) return 0
  const diff = Date.now() - new Date(dateIso).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

export default function OverdueLeadsTable({ leads, advisors }: OverdueLeadsTableProps) {
  const [reassignLead, setReassignLead] = useState<Lead | null>(null)

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <AlertTriangle className="text-emerald-500" size={22} />
        </div>
        <p className="font-semibold text-slate-900">No overdue follow-ups</p>
        <p className="text-sm text-slate-500 mt-1">Every lead is either on track or closed. Nice.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">Overdue by</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const overdue = daysOverdue(lead.next_followup_at)
              return (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5 group">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-700 shrink-0">
                        {getInitials(lead.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 group-hover:text-indigo-600 truncate">
                          {lead.full_name}
                        </p>
                        <p className="text-xs text-slate-500">{formatPhone(lead.phone)}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={lead.stage} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {lead.assigned_profile ? (
                      <span className="text-slate-700">{lead.assigned_profile.full_name}</span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                        overdue >= 3
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {overdue === 0 ? 'Today' : `${overdue} day${overdue > 1 ? 's' : ''}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={`tel:${lead.phone}`}
                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Call"
                      >
                        <Phone size={15} />
                      </a>
                      <a
                        href={`https://wa.me/${lead.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="WhatsApp"
                      >
                        <MessageSquare size={15} />
                      </a>
                      <button
                        onClick={() => setReassignLead(lead)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Reassign"
                      >
                        <UserCog size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {reassignLead && (
        <AssignModal
          leadId={reassignLead.id}
          currentAdvisorId={reassignLead.assigned_to}
          advisors={advisors}
          open={!!reassignLead}
          onClose={() => setReassignLead(null)}
        />
      )}
    </>
  )
}
