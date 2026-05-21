export const dynamic = 'force-dynamic'

import { getCandidates } from '@/lib/hr/queries'
import { createClient } from '@/lib/supabase/server'
import { CANDIDATE_STAGES } from '@/types/hr'
import { formatDate, formatCurrency } from '@/lib/utils'
import CandidateStageActions from '@/components/hr/CandidateStageActions'
import { ArrowLeft, Star, Phone, Mail, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function RecruitmentPage() {
  const supabase = await createClient()
  const [candidates, profilesRes] = await Promise.all([
    getCandidates(),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])
  const interviewers = profilesRes.data ?? []

  const grouped = CANDIDATE_STAGES.reduce((acc, s) => {
    acc[s.value] = candidates.filter(c => c.stage === s.value)
    return acc
  }, {} as Record<string, typeof candidates>)

  const activeCount = candidates.filter(c => !['joined', 'rejected'].includes(c.stage)).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recruitment Pipeline</h1>
          <p className="text-sm text-slate-500">{activeCount} active candidates · {candidates.filter(c => c.stage === 'joined').length} joined</p>
        </div>
      </div>

      {/* Stage summary bar */}
      <div className="flex gap-2 flex-wrap">
        {CANDIDATE_STAGES.map(s => {
          const count = grouped[s.value]?.length ?? 0
          if (count === 0 && ['joined', 'rejected'].includes(s.value)) return null
          return (
            <div key={s.value} className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
              {s.label} · {count}
            </div>
          )
        })}
      </div>

      {/* Candidate cards by stage */}
      <div className="space-y-6">
        {CANDIDATE_STAGES.filter(s => s.value !== 'rejected').map(stageConfig => {
          const stageCandidates = grouped[stageConfig.value] ?? []
          if (stageCandidates.length === 0) return null
          return (
            <div key={stageConfig.value} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className={`px-4 py-2.5 border-b border-slate-100 flex items-center justify-between`}>
                <span className={`text-sm font-semibold ${stageConfig.color}`}>{stageConfig.label}</span>
                <span className="text-xs text-slate-400">{stageCandidates.length} candidate{stageCandidates.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {stageCandidates.map(c => (
                  <div key={c.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                          {c.interview_rating && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: c.interview_rating }).map((_, i) => (
                                <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          {c.listing && <span className="text-indigo-600 font-medium">{c.listing.title}</span>}
                          {c.current_company && <span className="flex items-center gap-1"><Building2 size={11} />{c.current_company}</span>}
                          {c.experience_years && <span>{c.experience_years}y exp</span>}
                          {c.expected_ctc && <span>Expected {formatCurrency(c.expected_ctc)}</span>}
                          <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>
                          {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                          <span>{formatDate(c.created_at)}</span>
                        </div>
                        {c.interview_date && (
                          <p className="text-xs text-amber-600 mt-1">
                            Interview: {formatDate(c.interview_date)}
                            {c.interview_mode && ` (${c.interview_mode.replace('_', ' ')})`}
                            {c.interviewer && ` · ${c.interviewer.full_name}`}
                          </p>
                        )}
                        {c.interview_feedback && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{c.interview_feedback}</p>
                        )}
                        {c.offer_ctc && (
                          <p className="text-xs text-green-600 mt-1">Offer: {formatCurrency(c.offer_ctc)} CTC · {formatDate(c.offer_date ?? '')}</p>
                        )}
                      </div>
                      {c.resume_url && (
                        <a href={c.resume_url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-xs text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50">
                          Resume
                        </a>
                      )}
                    </div>
                    <CandidateStageActions
                      candidateId={c.id}
                      stage={c.stage}
                      interviewers={interviewers}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Rejected — collapsed */}
        {(grouped['rejected']?.length ?? 0) > 0 && (
          <details className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-500 hover:bg-slate-50">
              Rejected ({grouped['rejected'].length})
            </summary>
            <div className="divide-y divide-slate-100">
              {grouped['rejected'].map(c => (
                <div key={c.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-700">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.listing?.title}{c.rejection_reason && ` · ${c.rejection_reason}`} · {formatDate(c.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}

        {candidates.length === 0 && (
          <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            <p className="text-sm">No candidates yet. Applications from the website careers page appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
