'use client'

import { useState, useTransition } from 'react'
import { CalendarCheck, Plus, ClipboardCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { scheduleSiteVisit, recordSiteVisitOutcome } from '@/lib/leads/siteVisits'
import { formatDateTime, cn } from '@/lib/utils'
import type { SiteVisit } from '@/types/leads'

interface SiteVisitsCardProps {
  leadId: string
  defaultProjectId: string | null
  visits: SiteVisit[]
  advisors: { id: string; full_name: string; role: string }[]
  projects: { id: string; name: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  scheduled: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-red-50 text-red-700',
  no_show: 'bg-amber-50 text-amber-700',
}

export default function SiteVisitsCard({
  leadId,
  defaultProjectId,
  visits,
  advisors,
  projects,
}: SiteVisitsCardProps) {
  const [showSchedule, setShowSchedule] = useState(false)
  const [outcomeVisit, setOutcomeVisit] = useState<SiteVisit | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submitSchedule = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const res = await scheduleSiteVisit(formData)
      if (res.success) setShowSchedule(false)
      else setError(res.error ?? 'Failed to schedule')
    })
  }

  const submitOutcome = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const res = await recordSiteVisitOutcome(formData)
      if (res.success) setOutcomeVisit(null)
      else setError(res.error ?? 'Failed to record')
    })
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <CalendarCheck size={16} className="text-indigo-600" />
          Site Visits ({visits.length})
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setShowSchedule(true)}>
          <Plus size={14} />
          Schedule
        </Button>
      </div>

      {visits.length === 0 ? (
        <p className="text-sm text-slate-400">No site visits yet. Schedule one to move this lead forward.</p>
      ) : (
        <div className="space-y-2">
          {visits.map((visit) => (
            <div key={visit.id} className="p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{formatDateTime(visit.scheduled_at)}</p>
                  {visit.project && <p className="text-xs text-slate-500">{visit.project.name}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_STYLES[visit.status] ?? 'bg-slate-100 text-slate-600')}>
                    {visit.status}
                  </span>
                  {visit.status === 'scheduled' && (
                    <button
                      onClick={() => setOutcomeVisit(visit)}
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <ClipboardCheck size={13} />
                      Record
                    </button>
                  )}
                </div>
              </div>
              {visit.advisor_notes && <p className="text-xs text-slate-500 mt-1.5">Pre-visit: {visit.advisor_notes}</p>}
              {visit.client_feedback && <p className="text-xs text-slate-600 mt-1.5">Feedback: {visit.client_feedback}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Schedule modal */}
      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Site Visit" size="md">
        <form action={submitSchedule} className="space-y-4">
          <input type="hidden" name="lead_id" value={leadId} />
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Input label="Date & time" name="scheduled_at" type="datetime-local" required />
          <Select
            label="Project"
            name="project_id"
            defaultValue={defaultProjectId ?? ''}
            placeholder="Select a project"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="Accompanied by"
            name="accompanied_by"
            placeholder="Select an advisor"
            options={advisors.map((a) => ({ value: a.id, label: a.full_name }))}
          />
          <div>
            <label className="text-sm font-medium text-slate-700">Pre-visit details (shared with client)</label>
            <textarea
              name="advisor_notes"
              rows={2}
              placeholder="Meeting point, directions, what to bring…"
              className="mt-1.5 w-full rounded-lg border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowSchedule(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>Schedule Visit</Button>
          </div>
        </form>
      </Modal>

      {/* Outcome modal */}
      <Modal open={!!outcomeVisit} onClose={() => setOutcomeVisit(null)} title="Record Visit Outcome" size="md">
        {outcomeVisit && (
          <form action={submitOutcome} className="space-y-4">
            <input type="hidden" name="visit_id" value={outcomeVisit.id} />
            <input type="hidden" name="lead_id" value={leadId} />
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <Select
              label="Outcome"
              name="status"
              defaultValue="completed"
              options={[
                { value: 'completed', label: 'Completed' },
                { value: 'no_show', label: 'No-show' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <div>
              <label className="text-sm font-medium text-slate-700">Client feedback</label>
              <textarea
                name="client_feedback"
                rows={2}
                placeholder="What did the client think? Concerns, interest level…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
            <Input label="Next follow-up (optional)" name="followup_at" type="datetime-local" hint="Keeps the lead from going idle" />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOutcomeVisit(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending}>Save Outcome</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  )
}
