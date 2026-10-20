'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign, updateCampaign } from '@/lib/marketing/actions'
import { CAMPAIGN_PLATFORMS, CAMPAIGN_OBJECTIVES } from '@/types/marketing'
import type { MarketingCampaign } from '@/types/marketing'
import { Pencil, Plus } from 'lucide-react'
import Modal from '@/components/ui/Modal'

interface Props {
  projects: { id: string; name: string }[]
  /** Edit this campaign; omit to create a new one. */
  campaign?: MarketingCampaign
}

const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400'

export default function CampaignForm({ projects, campaign }: Props) {
  const router = useRouter()
  const editing = Boolean(campaign)
  const idp = campaign ? `campaignform-${campaign.id}` : 'campaignform'
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(campaign?.start_date ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = campaign ? await updateCampaign(campaign.id, formData) : await createCampaign(formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? (editing ? 'Failed to save campaign' : 'Failed to create campaign'))
      } else {
        if (!editing) {
          form.reset()
          setStartDate('')
        }
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      {editing ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
        >
          <Pencil size={12} /> Edit
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} /> New Campaign
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit · ${campaign!.name}` : 'New Campaign'} size="lg">

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor={`${idp}-name`} className="block text-sm font-medium text-slate-700 mb-1">Campaign Name <span className="text-red-500">*</span></label>
                  <input id={`${idp}-name`} name="name" required defaultValue={campaign?.name} placeholder="e.g. Vedanta Hills – May 2025 – Facebook"
                    className={INPUT} />
                  <p className="text-xs text-slate-400 mt-1">For Meta lead ads, use the campaign name exactly as in Ads Manager (or add the Meta campaign ID below) so its leads are matched.</p>
                </div>

                <div>
                  <label htmlFor={`${idp}-platform`} className="block text-sm font-medium text-slate-700 mb-1">Platform <span className="text-red-500">*</span></label>
                  <select id={`${idp}-platform`} name="platform" required defaultValue={campaign?.platform} className={INPUT}>
                    {CAMPAIGN_PLATFORMS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${idp}-objective`} className="block text-sm font-medium text-slate-700 mb-1">Objective</label>
                  <select id={`${idp}-objective`} name="objective" defaultValue={campaign?.objective ?? ''} className={INPUT}>
                    <option value="">Select objective</option>
                    {CAMPAIGN_OBJECTIVES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${idp}-project-id`} className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                  <select id={`${idp}-project-id`} name="project_id" defaultValue={campaign?.project_id ?? ''} className={INPUT}>
                    <option value="">All projects</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${idp}-budget`} className="block text-sm font-medium text-slate-700 mb-1">Budget (₹)</label>
                  <input id={`${idp}-budget`} name="budget" type="number" min="0" step="any" placeholder="50000"
                    defaultValue={campaign?.budget || ''} className={INPUT} />
                </div>

                <div>
                  <label htmlFor={`${idp}-start-date`} className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input id={`${idp}-start-date`} name="start_date" type="date" required value={startDate}
                    onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
                </div>

                <div>
                  <label htmlFor={`${idp}-end-date`} className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input id={`${idp}-end-date`} name="end_date" type="date" min={startDate || undefined}
                    defaultValue={campaign?.end_date ?? ''} className={INPUT} />
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">UTM Parameters</p>
                  <p className="text-xs text-slate-400 mb-3">Leads are matched to this campaign by Meta campaign ID, then utm_campaign, then campaign name (not case-sensitive). Without any of them, the campaign shows spend but no leads.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={`${idp}-utm-source`} className="block text-xs text-slate-600 mb-1">utm_source</label>
                      <input id={`${idp}-utm-source`} name="utm_source" placeholder="facebook" defaultValue={campaign?.utm_source ?? ''} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor={`${idp}-utm-medium`} className="block text-xs text-slate-600 mb-1">utm_medium</label>
                      <input id={`${idp}-utm-medium`} name="utm_medium" placeholder="cpc" defaultValue={campaign?.utm_medium ?? ''} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor={`${idp}-utm-campaign`} className="block text-xs text-slate-600 mb-1">utm_campaign</label>
                      <input id={`${idp}-utm-campaign`} name="utm_campaign" placeholder="vedanta-jaipur-may25" defaultValue={campaign?.utm_campaign ?? ''} className={INPUT} />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Meta IDs (optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`${idp}-meta-campaign-id`} className="block text-xs text-slate-600 mb-1">Meta Campaign ID</label>
                      <input id={`${idp}-meta-campaign-id`} name="meta_campaign_id" placeholder="120210..." inputMode="numeric"
                        defaultValue={campaign?.meta_campaign_id ?? ''} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor={`${idp}-meta-adset-id`} className="block text-xs text-slate-600 mb-1">Meta Ad Set ID</label>
                      <input id={`${idp}-meta-adset-id`} name="meta_adset_id" placeholder="120211..." inputMode="numeric"
                        defaultValue={campaign?.meta_adset_id ?? ''} className={INPUT} />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`${idp}-notes`} className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea id={`${idp}-notes`} name="notes" rows={2} defaultValue={campaign?.notes ?? ''} className={INPUT} />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50">
                  {loading ? 'Saving...' : editing ? 'Save Changes' : 'Create Campaign'}
                </button>
              </div>
            </form>
      </Modal>
    </>
  )
}
