'use client'

import { useTransition } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { scheduleFollowUp } from '@/lib/leads/actions'
import { format, addHours, addDays } from 'date-fns'

interface FollowUpModalProps {
  leadId: string
  open: boolean
  onClose: () => void
}

const QUICK_TIMES = [
  { label: 'In 1 hour', value: () => addHours(new Date(), 1) },
  { label: 'In 4 hours', value: () => addHours(new Date(), 4) },
  { label: 'Tomorrow 10 AM', value: () => { const d = addDays(new Date(), 1); d.setHours(10, 0, 0); return d } },
  { label: 'Tomorrow 6 PM', value: () => { const d = addDays(new Date(), 1); d.setHours(18, 0, 0); return d } },
  { label: 'In 3 days', value: () => addDays(new Date(), 3) },
  { label: 'Next week', value: () => addDays(new Date(), 7) },
]

export default function FollowUpModal({ leadId, open, onClose }: FollowUpModalProps) {
  const [isPending, startTransition] = useTransition()

  const handleQuick = (getDate: () => Date) => {
    const date = getDate()
    startTransition(async () => {
      await scheduleFollowUp(leadId, date.toISOString())
      onClose()
    })
  }

  const handleCustom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const value = formData.get('followup_at') as string
    if (!value) return
    startTransition(async () => {
      await scheduleFollowUp(leadId, new Date(value).toISOString())
      onClose()
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Follow-up" size="sm">
      <div className="space-y-4">
        {/* Quick options */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Schedule</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TIMES.map((t) => (
              <button
                key={t.label}
                onClick={() => handleQuick(t.value)}
                disabled={isPending}
                className="px-3 py-2.5 text-sm text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all text-left"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or custom time</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Custom */}
        <form onSubmit={handleCustom} className="space-y-3">
          <input
            type="datetime-local"
            name="followup_at"
            defaultValue={format(addHours(new Date(), 24), "yyyy-MM-dd'T'HH:mm")}
            className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button type="submit" loading={isPending} className="w-full justify-center">
            Schedule Follow-up
          </Button>
        </form>
      </div>
    </Modal>
  )
}
