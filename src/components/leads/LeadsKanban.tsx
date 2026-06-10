'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Phone, MessageSquare, ChevronDown, Clock, Calendar } from 'lucide-react'
import type { Lead, LeadStage } from '@/types/leads'
import { STAGE_CONFIG, STAGE_ORDER } from '@/types/leads'
import StageBadge from './StageBadge'
import TemperatureBadge from './TemperatureBadge'
import ScoreBadge from './ScoreBadge'
import { changeLeadStage } from '@/lib/leads/actions'
import { formatPhone, getInitials, isFollowUpOverdue } from '@/lib/utils'
import RelativeTime from '@/components/ui/RelativeTime'
import { cn } from '@/lib/utils'

interface LeadsKanbanProps {
  leads: Lead[]
}

const KANBAN_STAGES: LeadStage[] = [
  'new_lead',
  'contacted',
  'interested',
  'site_visit_scheduled',
  'site_visit_done',
  'negotiation',
  'token_paid',
]

function LeadKanbanCard({ lead }: { lead: Lead }) {
  const [isChangingStage, setIsChangingStage] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const overdue = isFollowUpOverdue(lead)

  const handleStageChange = async (newStage: LeadStage) => {
    setIsChangingStage(true)
    setShowStageMenu(false)
    await changeLeadStage(lead.id, newStage)
    setIsChangingStage(false)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-sm p-3.5 hover:shadow-md transition-shadow',
        lead.temperature === 'hot' && 'border-red-200',
        isChangingStage && 'opacity-60 pointer-events-none'
      )}
    >
      {/* Top: temp + score */}
      <div className="flex items-center justify-between mb-2.5">
        <TemperatureBadge temperature={lead.temperature} />
        <ScoreBadge score={lead.score} />
      </div>

      {/* Name */}
      <Link href={`/leads/${lead.id}`} className="block group">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-700 shrink-0">
            {getInitials(lead.full_name)}
          </div>
          <span className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
            {lead.full_name}
          </span>
        </div>
      </Link>

      {/* Phone */}
      <div className="flex items-center gap-2 mb-2.5 pl-9">
        <span className="text-xs text-slate-500">{formatPhone(lead.phone)}</span>
        <div className="flex gap-1">
          <a href={`tel:${lead.phone}`} className="text-slate-300 hover:text-green-600 transition-colors">
            <Phone size={11} />
          </a>
          <a
            href={`https://wa.me/${lead.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-green-600 transition-colors"
          >
            <MessageSquare size={11} />
          </a>
        </div>
      </div>

      {/* Project */}
      {lead.project && (
        <p className="text-xs text-slate-500 mb-2 pl-9 truncate">{lead.project.name}</p>
      )}

      {/* Follow-up */}
      {lead.next_followup_at && (
        <p
          className={cn(
            'flex items-center gap-1 text-xs mb-2.5 pl-9',
            overdue ? 'text-red-600 font-medium' : 'text-slate-400'
          )}
        >
          {overdue
            ? <><Clock size={10} /> Overdue: </>
            : <Calendar size={10} />
          }
          <RelativeTime date={lead.next_followup_at} />
        </p>
      )}

      {/* Assigned */}
      {lead.assigned_profile && (
        <div className="flex items-center gap-1.5 mb-2.5 pl-9">
          <div className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-medium text-slate-600">
            {getInitials(lead.assigned_profile.full_name)}
          </div>
          <span className="text-xs text-slate-500 truncate">{lead.assigned_profile.full_name}</span>
        </div>
      )}

      {/* Stage change dropdown */}
      <div className="relative mt-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => setShowStageMenu((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <StageBadge stage={lead.stage} size="sm" />
          <ChevronDown size={12} className={cn('transition-transform', showStageMenu && 'rotate-180')} />
        </button>

        {showStageMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-slate-200 shadow-lg z-10 overflow-hidden">
            {STAGE_ORDER.map((stage) => {
              const cfg = STAGE_CONFIG[stage]
              if (stage === lead.stage) return null
              return (
                <button
                  key={stage}
                  onClick={() => handleStageChange(stage)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors',
                    cfg.textColor
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeadsKanban({ leads }: LeadsKanbanProps) {
  const byStage = KANBAN_STAGES.reduce<Record<string, Lead[]>>((acc, stage) => {
    acc[stage] = leads.filter((l) => l.stage === stage)
    return acc
  }, {})

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {KANBAN_STAGES.map((stage) => {
        const cfg = STAGE_CONFIG[stage]
        const stageLeads = byStage[stage]

        return (
          <div key={stage} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className={cn('rounded-t-xl px-4 py-3 border-b-2', cfg.bgColor, cfg.borderColor)}>
              <div className="flex items-center justify-between">
                <h3 className={cn('text-sm font-semibold', cfg.textColor)}>{cfg.label}</h3>
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    cfg.bgColor,
                    cfg.textColor
                  )}
                >
                  {stageLeads.length}
                </span>
              </div>
              {cfg.slaHours && (
                <p className="text-xs text-slate-400 mt-0.5">SLA: {cfg.slaHours}h</p>
              )}
            </div>

            {/* Cards */}
            <div
              className={cn(
                'min-h-[400px] rounded-b-xl p-3 space-y-3',
                cfg.bgColor,
                'bg-opacity-30'
              )}
            >
              {stageLeads.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  No leads
                </div>
              ) : (
                stageLeads.map((lead) => <LeadKanbanCard key={lead.id} lead={lead} />)
              )}
            </div>
          </div>
        )
      })}

      {/* Terminal stages summary */}
      <div className="flex-shrink-0 w-52 space-y-3">
        {(['closed_won', 'not_interested', 'future_followup'] as LeadStage[]).map((stage) => {
          const cfg = STAGE_CONFIG[stage]
          const count = leads.filter((l) => l.stage === stage).length
          return (
            <div
              key={stage}
              className={cn('rounded-xl px-4 py-3 border', cfg.bgColor, cfg.borderColor)}
            >
              <p className={cn('text-sm font-semibold', cfg.textColor)}>{cfg.label}</p>
              <p className={cn('text-2xl font-bold mt-1', cfg.textColor)}>{count}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
