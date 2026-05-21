import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Phone, MessageSquare, Mail, MapPin, Building2,
  CalendarCheck, Clock, Edit2, UserCheck, ArrowLeft,
  Banknote, Target, Zap
} from 'lucide-react'
import { getLeadById, getLeadActivities, getSiteVisits, getActiveAdvisors } from '@/lib/leads/queries'
import { STAGE_CONFIG, STAGE_ORDER, SOURCE_LABELS } from '@/types/leads'
import StageBadge from '@/components/leads/StageBadge'
import TemperatureBadge from '@/components/leads/TemperatureBadge'
import ScoreBadge from '@/components/leads/ScoreBadge'
import ActivityTimeline from '@/components/leads/ActivityTimeline'
import LeadDetailActions from '@/components/leads/LeadDetailActions'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { formatDate, formatDateTime, formatPhone, formatBudgetRange } from '@/lib/utils'
import RelativeTime from '@/components/ui/RelativeTime'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params
  const [lead, activities, siteVisits] = await Promise.all([
    getLeadById(id),
    getLeadActivities(id),
    getSiteVisits(id),
  ])

  if (!lead) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('branch_id')
    .eq('id', user.id)
    .single()

  const advisors = await getActiveAdvisors(profile?.branch_id ?? undefined)

  const currentStageIndex = STAGE_ORDER.indexOf(lead.stage)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref="/leads"
        title={<>{lead.full_name}<TemperatureBadge temperature={lead.temperature} /></>}
        subtitle={<>Lead #{lead.id.slice(0, 8).toUpperCase()} · Added <RelativeTime date={lead.created_at} /></>}
        actions={
          <>
            <Button href={`tel:${lead.phone}`} variant="secondary" size="sm">
              <Phone size={16} /> Call
            </Button>
            <Button
              href={`https://wa.me/${lead.phone}`}
              external
              variant="secondary"
              size="sm"
            >
              <MessageSquare size={16} /> WhatsApp
            </Button>
            <Button href={`/leads/${id}/edit`} variant="secondary" size="sm">
              <Edit2 size={16} /> Edit
            </Button>
          </>
        }
      />

      {/* Stage pipeline */}
      <Card padding="md">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STAGE_ORDER.map((stage, i) => {
            const cfg = STAGE_CONFIG[stage]
            const isActive = lead.stage === stage
            const isDone = i < currentStageIndex
            const isTerminal = stage === 'not_interested' || stage === 'future_followup'

            if (isTerminal && !isActive) return null

            return (
              <div key={stage} className="flex items-center gap-1 shrink-0">
                <div
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    isActive
                      ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor} ring-2 ring-offset-1 ring-current`
                      : isDone
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  )}
                >
                  {cfg.label}
                </div>
                {i < STAGE_ORDER.length - 3 && (
                  <div
                    className={cn(
                      'h-px w-4',
                      isDone ? 'bg-green-300' : 'bg-slate-200'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Quick stats */}
          <Card padding="md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Lead Score</span>
                <ScoreBadge score={lead.score} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Stage</span>
                <StageBadge stage={lead.stage} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">SLA</span>
                {lead.sla_status === 'on_time' && (
                  <span className="text-xs text-green-600 font-medium">On Time</span>
                )}
                {lead.sla_status === 'at_risk' && (
                  <span className="text-xs text-amber-600 font-medium">
                    {lead.sla_hours_remaining}h left
                  </span>
                )}
                {lead.sla_status === 'breached' && (
                  <span className="text-xs text-red-600 font-medium">Breached</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Follow-ups</span>
                <span className="text-sm font-medium text-slate-700">{lead.follow_up_count}</span>
              </div>
              {lead.next_followup_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Next Follow-up</span>
                  <RelativeTime date={lead.next_followup_at} className="text-xs text-slate-700" />
                </div>
              )}
            </div>
          </Card>

          {/* Contact info */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="text-slate-400 shrink-0" />
                <div>
                  <a href={`tel:${lead.phone}`} className="text-sm text-indigo-600 hover:underline font-medium">
                    {formatPhone(lead.phone)}
                  </a>
                  {lead.alternate_phone && (
                    <p className="text-xs text-slate-400 mt-0.5">{formatPhone(lead.alternate_phone)}</p>
                  )}
                </div>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={15} className="text-slate-400 shrink-0" />
                  <a href={`mailto:${lead.email}`} className="text-sm text-indigo-600 hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {(lead.city || lead.locality) && (
                <div className="flex items-center gap-2.5">
                  <MapPin size={15} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700">
                    {[lead.locality, lead.city].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Interest */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Interest</h3>
            <div className="space-y-2.5">
              {lead.project && (
                <div className="flex items-start gap-2.5">
                  <Building2 size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{lead.project.name}</p>
                    <p className="text-xs text-slate-400">{lead.project.city}</p>
                  </div>
                </div>
              )}
              {(lead.budget_min || lead.budget_max) && (
                <div className="flex items-center gap-2.5">
                  <Banknote size={15} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700">
                    {formatBudgetRange(lead.budget_min, lead.budget_max)}
                  </span>
                </div>
              )}
              {lead.configuration && (
                <div className="flex items-center gap-2.5">
                  <Target size={15} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700">{lead.configuration}</span>
                </div>
              )}
              {lead.purpose && (
                <p className="text-xs text-slate-500 pl-7 capitalize">
                  Purpose: {lead.purpose.replace('_', ' ')}
                </p>
              )}
              {lead.timeline && (
                <p className="text-xs text-slate-500 pl-7">
                  Timeline: {lead.timeline.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          </Card>

          {/* Source */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Source & UTM</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Source</span>
                <span className="text-slate-800 font-medium text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                  {SOURCE_LABELS[lead.source]}
                </span>
              </div>
              {lead.campaign_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Campaign</span>
                  <span className="text-slate-700 text-right text-xs max-w-[150px] truncate">{lead.campaign_name}</span>
                </div>
              )}
              {lead.utm_source && (
                <div className="flex justify-between">
                  <span className="text-slate-500">UTM Source</span>
                  <span className="text-slate-700 text-xs">{lead.utm_source}</span>
                </div>
              )}
              {lead.utm_campaign && (
                <div className="flex justify-between">
                  <span className="text-slate-500">UTM Campaign</span>
                  <span className="text-slate-700 text-xs max-w-[120px] truncate">{lead.utm_campaign}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-100 mt-1">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-700 text-xs">{formatDateTime(lead.created_at)}</span>
              </div>
            </div>
          </Card>

          {/* Assignment */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Assignment</h3>
            {lead.assigned_profile ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-semibold text-indigo-700">
                  {lead.assigned_profile.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{lead.assigned_profile.full_name}</p>
                  <p className="text-xs text-slate-500 capitalize">{lead.assigned_profile.role?.replace('_', ' ')}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500">Unassigned</p>
            )}
          </Card>
        </div>

        {/* Right column: actions + timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Action buttons */}
          <LeadDetailActions
            lead={lead}
            advisors={advisors}
          />

          {/* Site visits */}
          {siteVisits.length > 0 && (
            <Card padding="md">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CalendarCheck size={16} className="text-indigo-600" />
                Site Visits ({siteVisits.length})
              </h3>
              <div className="space-y-2">
                {siteVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDateTime(visit.scheduled_at)}
                      </p>
                      {visit.project && (
                        <p className="text-xs text-slate-500">{visit.project.name}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        visit.status === 'completed'
                          ? 'bg-green-50 text-green-700'
                          : visit.status === 'scheduled'
                          ? 'bg-blue-50 text-blue-700'
                          : visit.status === 'cancelled'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {visit.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card padding="md">
            <ActivityTimeline activities={activities} leadId={id} />
          </Card>
        </div>
      </div>
    </div>
  )
}
