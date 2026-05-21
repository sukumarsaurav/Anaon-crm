'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Phone, MessageSquare, ArrowUpDown, ChevronRight, Clock, Search } from 'lucide-react'
import type { Lead } from '@/types/leads'
import StageBadge from './StageBadge'
import TemperatureBadge from './TemperatureBadge'
import ScoreBadge from './ScoreBadge'
import BulkActionsBar from './BulkActionsBar'
import EmptyState from '@/components/ui/EmptyState'
import RelativeTime from '@/components/ui/RelativeTime'
import { formatPhone, formatBudgetRange, getInitials, isFollowUpOverdue } from '@/lib/utils'
import { SOURCE_LABELS } from '@/types/leads'
import { cn } from '@/lib/utils'

interface LeadsTableProps {
  leads: Lead[]
  advisors: { id: string; full_name: string }[]
}

export default function LeadsTable({ leads, advisors }: LeadsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map((l) => l.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        bordered
        icon={<Search size={40} />}
        title="No leads found"
        description="Try adjusting your filters or add a new lead."
      />
    )
  }

  return (
    <div className="relative">
      {selected.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selected)}
          advisors={advisors}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === leads.length && leads.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
                  <button className="flex items-center gap-1 hover:text-slate-900">
                    Lead <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Project Interest</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Stage</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Temp</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  <button className="flex items-center gap-1 hover:text-slate-900">
                    Score <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Assigned To</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Next Follow-up</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Added</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => {
                const overdue = isFollowUpOverdue(lead)
                const isSelected = selected.has(lead.id)

                return (
                  <tr
                    key={lead.id}
                    className={cn(
                      'hover:bg-slate-50 transition-colors group',
                      isSelected && 'bg-indigo-50/50'
                    )}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(lead.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Name + phone */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-700 shrink-0">
                          {getInitials(lead.full_name)}
                        </div>
                        <div>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                          >
                            {lead.full_name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">{formatPhone(lead.phone)}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-slate-400 hover:text-green-600 transition-colors"
                                title="Call"
                              >
                                <Phone size={12} />
                              </a>
                              <a
                                href={`https://wa.me/${lead.phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-green-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                        {SOURCE_LABELS[lead.source]}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="px-4 py-3.5">
                      <div>
                        {lead.project ? (
                          <span className="text-sm text-slate-700">{lead.project.name}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Not specified</span>
                        )}
                        {(lead.budget_min || lead.budget_max) && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatBudgetRange(lead.budget_min, lead.budget_max)}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3.5">
                      <StageBadge stage={lead.stage} size="sm" />
                      {lead.sla_status === 'breached' && (
                        <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                          <Clock size={10} /> SLA breached
                        </p>
                      )}
                      {lead.sla_status === 'at_risk' && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <Clock size={10} /> {lead.sla_hours_remaining}h left
                        </p>
                      )}
                    </td>

                    {/* Temperature */}
                    <td className="px-4 py-3.5">
                      <TemperatureBadge temperature={lead.temperature} showLabel={false} />
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3.5">
                      <ScoreBadge score={lead.score} />
                    </td>

                    {/* Assigned */}
                    <td className="px-4 py-3.5">
                      {lead.assigned_profile ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                            {getInitials(lead.assigned_profile.full_name)}
                          </div>
                          <span className="text-sm text-slate-700 truncate max-w-[100px]">
                            {lead.assigned_profile.full_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">Unassigned</span>
                      )}
                    </td>

                    {/* Next follow-up */}
                    <td className="px-4 py-3.5">
                      {lead.next_followup_at ? (
                        <span className={cn('flex items-center gap-1 text-xs', overdue ? 'text-red-600 font-medium' : 'text-slate-500')}>
                          {overdue && <Clock size={11} />}
                          <RelativeTime date={lead.next_followup_at} />
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3.5">
                      <RelativeTime date={lead.created_at} className="text-xs text-slate-400" />
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3.5">
                      <Link href={`/leads/${lead.id}`}>
                        <ChevronRight
                          size={16}
                          className="text-slate-300 group-hover:text-indigo-500 transition-colors"
                        />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
      </div>
    </div>
  )
}
