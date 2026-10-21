'use client'

import { todayIST } from '@/lib/datetime'
import { useState, startTransition, useId } from 'react'
import { useRouter } from 'next/navigation'
import { updateCandidateStage, scheduleInterview, submitInterviewFeedback, makeOffer } from '@/lib/hr/actions'
import type { CandidateStage } from '@/types/hr'
import { ChevronRight, Calendar, Star, Gift, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Props {
  candidateId: string
  stage: CandidateStage
  interviewers: { id: string; full_name: string }[]
}

export default function CandidateStageActions({ candidateId, stage, interviewers }: Props) {
  const uid = useId()
  const router = useRouter()
  const [panel, setPanel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  // Every step used to ignore the result, so a failed save looked like nothing happened.
  function submit(fn: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true)
    startTransition(async () => {
      const res = await fn()
      setLoading(false)
      if (!res.success) { toast.error(res.error ?? 'Could not save'); return }
      setPanel(null)
      router.refresh()
    })
  }

  const move = (next: CandidateStage) => submit(() => updateCandidateStage(candidateId, next))
  const formHandler = (fn: (id: string, fd: FormData) => Promise<{ success: boolean; error?: string }>) =>
    (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); submit(() => fn(candidateId, fd)) }
  const handleSchedule = formHandler(scheduleInterview)
  const handleFeedback = formHandler(submitInterviewFeedback)
  const handleOffer = formHandler(makeOffer)

  const today = todayIST()

  return (
    <div className="space-y-2">
      {/* Primary actions based on current stage */}
      <div className="flex flex-wrap gap-2">
        {stage === 'applied' && (
          <button onClick={() => move('shortlisted')} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <ChevronRight size={13} /> Shortlist
          </button>
        )}
        {stage === 'shortlisted' && (
          <button onClick={() => setPanel('schedule')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            <Calendar size={13} /> Schedule Interview
          </button>
        )}
        {stage === 'interview_scheduled' && (
          <button onClick={() => setPanel('feedback')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Star size={13} /> Submit Feedback
          </button>
        )}
        {stage === 'interview_done' && (
          <button onClick={() => setPanel('offer')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Gift size={13} /> Make Offer
          </button>
        )}
        {stage === 'offer' && (
          <button onClick={() => move('joined')} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            <ChevronRight size={13} /> Mark Joined
          </button>
        )}
        {!['joined', 'rejected'].includes(stage) && (
          <button onClick={() => setPanel('reject')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
            <XCircle size={13} /> Reject
          </button>
        )}
      </div>

      {/* Panels */}
      {panel === 'schedule' && (
        <form onSubmit={handleSchedule} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Schedule Interview</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor={`${uid}-interview-date`} className="block text-xs text-slate-600 mb-1">Date & Time</label>
              <input id={`${uid}-interview-date`} name="interview_date" type="datetime-local" required min={`${today}T00:00`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
            </div>
            <div>
              <label htmlFor={`${uid}-interview-mode`} className="block text-xs text-slate-600 mb-1">Mode</label>
              <select id={`${uid}-interview-mode`} name="interview_mode" required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
                <option value="in_person">In Person</option>
                <option value="video">Video Call</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-interviewer-id`} className="block text-xs text-slate-600 mb-1">Interviewer</label>
              <select id={`${uid}-interviewer-id`} name="interviewer_id"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
                <option value="">Assign later</option>
                {interviewers.map(i => (
                  <option key={i.id} value={i.id}>{i.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)}
              className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-1.5 text-xs bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Schedule'}
            </button>
          </div>
        </form>
      )}

      {panel === 'feedback' && (
        <form onSubmit={handleFeedback} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Interview Feedback</p>
          <div>
            <label htmlFor={`${uid}-interview-rating`} className="block text-xs text-slate-600 mb-1">Rating (1-5)</label>
            <select id={`${uid}-interview-rating`} name="interview_rating" required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
              {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} — {['','Poor','Below Avg','Average','Good','Excellent'][r]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-interview-feedback`} className="block text-xs text-slate-600 mb-1">Feedback</label>
            <textarea id={`${uid}-interview-feedback`} name="interview_feedback" rows={3} required
              placeholder="Skills assessment, strengths, concerns..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
          </div>
          <div>
            <label htmlFor={`${uid}-recommendation`} className="block text-xs text-slate-600 mb-1">Recommendation</label>
            <select id={`${uid}-recommendation`} name="recommendation"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
              <option value="yes">Recommend for Offer</option>
              <option value="no">Do Not Recommend</option>
              <option value="maybe">On Hold</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)}
              className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-1.5 text-xs bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      )}

      {panel === 'offer' && (
        <form onSubmit={handleOffer} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Offer Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-offer-ctc`} className="block text-xs text-slate-600 mb-1">Offer CTC (₹/year)</label>
              <input id={`${uid}-offer-ctc`} name="offer_ctc" type="number" min="0" required placeholder="600000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
            </div>
            <div>
              <label htmlFor={`${uid}-offer-date`} className="block text-xs text-slate-600 mb-1">Offer Date</label>
              <input id={`${uid}-offer-date`} name="offer_date" type="date" required defaultValue={today}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)}
              className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-1.5 text-xs bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Send Offer'}
            </button>
          </div>
        </form>
      )}

      {panel === 'reject' && (
        <form onSubmit={formHandler((id, fd) => updateCandidateStage(id, 'rejected', fd))} className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-red-700">Confirm Rejection</p>
          <div>
            <label htmlFor={`${uid}-rejection-reason`} className="block text-xs text-slate-600 mb-1">Reason</label>
            <input id={`${uid}-rejection-reason`} name="rejection_reason" placeholder="e.g. Skills mismatch, high CTC expectation"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanel(null)}
              className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-1.5 text-xs bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
