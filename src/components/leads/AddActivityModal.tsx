'use client'

import { useState, useTransition } from 'react'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { logActivity } from '@/lib/leads/actions'
import { FOLLOW_UP_OUTCOME_LABELS } from '@/types/leads'
import { format, addHours } from 'date-fns'

interface AddActivityModalProps {
  leadId: string
  open: boolean
  onClose: () => void
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'note', label: 'Note' },
  { value: 'sms', label: 'SMS' },
]

const OUTCOME_OPTIONS = Object.entries(FOLLOW_UP_OUTCOME_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export default function AddActivityModal({ leadId, open, onClose }: AddActivityModalProps) {
  const [isPending, startTransition] = useTransition()
  const [activityType, setActivityType] = useState('call')
  const [outcome, setOutcome] = useState('')
  const [scheduleFollowup, setScheduleFollowup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultFollowupTime = format(addHours(new Date(), 4), "yyyy-MM-dd'T'HH:mm")

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('lead_id', leadId)
    formData.set('schedule_followup', scheduleFollowup ? 'true' : 'false')
    setError(null)

    startTransition(async () => {
      const result = await logActivity(formData)
      if (result.success) {
        onClose()
      } else {
        setError(result.error ?? 'Failed to log activity')
      }
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Activity"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button form="activity-form" type="submit" loading={isPending}>
            Log Activity
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <Select
          label="Activity Type"
          name="type"
          required
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          options={ACTIVITY_TYPE_OPTIONS}
        />

        {(activityType === 'call' || activityType === 'whatsapp') && (
          <Select
            label="Outcome"
            name="outcome"
            placeholder="Select outcome"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value)
              if (
                e.target.value === 'not_reachable' ||
                e.target.value === 'callback_requested'
              ) {
                setScheduleFollowup(true)
              }
            }}
            options={OUTCOME_OPTIONS}
          />
        )}

        {activityType === 'call' && (
          <Input
            label="Call Duration (seconds)"
            name="duration_seconds"
            type="number"
            placeholder="e.g. 180 (3 minutes)"
            min={0}
          />
        )}

        <Textarea
          label="Notes"
          name="notes"
          placeholder="What was discussed? What's the next step?"
          rows={4}
          required={activityType === 'note'}
        />

        {/* Schedule follow-up */}
        <div className="border border-slate-200 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleFollowup}
              onChange={(e) => setScheduleFollowup(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">Schedule next follow-up</span>
          </label>

          {scheduleFollowup && (
            <div className="mt-3">
              <input
                type="datetime-local"
                name="followup_at"
                defaultValue={defaultFollowupTime}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {outcome === 'not_reachable' && (
                <p className="text-xs text-amber-600 mt-1">
                  Suggested: 4 hours from now (auto-set for not reachable)
                </p>
              )}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
