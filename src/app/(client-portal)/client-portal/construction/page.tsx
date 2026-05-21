export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalSession, getPortalClientData } from '@/lib/portal/queries'
import { formatDate } from '@/lib/utils'
import { Building2, CheckCircle, Clock } from 'lucide-react'

export default async function ClientPortalConstructionPage() {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const data = await getPortalClientData(session.client.id)
  const { constructionUpdates, booking } = data

  const latestPct = constructionUpdates[0]?.percentage_complete ?? 0

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Construction Progress</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {booking?.project?.name ?? 'Your project'} · {booking?.plot?.plot_number ? `Plot ${booking.plot.plot_number}` : ''}
        </p>
      </div>

      {/* Overall progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Overall Progress</h3>
          <span className="text-2xl font-bold text-indigo-600">{latestPct}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-4 mb-2">
          <div className="bg-indigo-600 h-4 rounded-full transition-all"
            style={{ width: `${latestPct}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          {latestPct === 0 ? 'Construction not yet started' :
           latestPct === 100 ? 'Construction complete — possession imminent' :
           `${100 - latestPct}% remaining`}
        </p>
      </div>

      {/* Timeline */}
      {constructionUpdates.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No construction updates posted yet</p>
          <p className="text-xs mt-1">Updates will appear here as work progresses</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900 text-sm">Update Timeline</h3>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />

            <div className="space-y-4">
              {constructionUpdates.map((update, i) => (
                <div key={update.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    i === 0 ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                  }`}>
                    {i === 0
                      ? <CheckCircle size={14} className="text-white" />
                      : <Clock size={14} className="text-slate-400" />
                    }
                  </div>

                  <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 mb-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-900">{update.title}</h4>
                      <span className="text-xs text-slate-400 shrink-0">{formatDate(update.update_date)}</span>
                    </div>

                    {update.milestone && (
                      <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full mb-2">
                        {update.milestone}
                      </span>
                    )}

                    {update.description && (
                      <p className="text-sm text-slate-600 mb-3">{update.description}</p>
                    )}

                    {/* Progress */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full">
                        <div className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${update.percentage_complete}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-green-700 shrink-0">
                        {update.percentage_complete}%
                      </span>
                    </div>

                    {/* Photos */}
                    {update.photos && update.photos.length > 0 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                        {update.photos.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Photo ${idx + 1}`}
                              className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}

                    {update.poster && (
                      <p className="text-xs text-slate-400 mt-2">Posted by {update.poster.full_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
