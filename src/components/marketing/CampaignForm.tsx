'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign } from '@/lib/marketing/actions'
import { CAMPAIGN_PLATFORMS, CAMPAIGN_OBJECTIVES } from '@/types/marketing'
import { Plus } from 'lucide-react'
import Modal from '@/components/ui/Modal'

interface Props {
  projects: { id: string; name: string }[]
}

export default function CampaignForm({ projects }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await createCampaign(formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to create campaign')
      } else {
        ;(e.target as HTMLFormElement).reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
      >
        <Plus size={16} /> New Campaign
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Campaign" size="lg">

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="campaignform-name" className="block text-sm font-medium text-slate-700 mb-1">Campaign Name <span className="text-red-500">*</span></label>
                  <input id="campaignform-name" name="name" required placeholder="e.g. Vedanta Hills – May 2025 – Facebook"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                </div>

                <div>
                  <label htmlFor="campaignform-platform" className="block text-sm font-medium text-slate-700 mb-1">Platform <span className="text-red-500">*</span></label>
                  <select id="campaignform-platform" name="platform" required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
                    {CAMPAIGN_PLATFORMS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="campaignform-objective" className="block text-sm font-medium text-slate-700 mb-1">Objective</label>
                  <select id="campaignform-objective" name="objective"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
                    <option value="">Select objective</option>
                    {CAMPAIGN_OBJECTIVES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="campaignform-project-id" className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                  <select id="campaignform-project-id" name="project_id"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
                    <option value="">All projects</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="campaignform-budget" className="block text-sm font-medium text-slate-700 mb-1">Budget (₹)</label>
                  <input id="campaignform-budget" name="budget" type="number" min="0" step="100" placeholder="50000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                </div>

                <div>
                  <label htmlFor="campaignform-start-date" className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input id="campaignform-start-date" name="start_date" type="date" required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                </div>

                <div>
                  <label htmlFor="campaignform-end-date" className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input id="campaignform-end-date" name="end_date" type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">UTM Parameters</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="campaignform-utm-source" className="block text-xs text-slate-600 mb-1">utm_source</label>
                      <input id="campaignform-utm-source" name="utm_source" placeholder="facebook"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                    </div>
                    <div>
                      <label htmlFor="campaignform-utm-medium" className="block text-xs text-slate-600 mb-1">utm_medium</label>
                      <input id="campaignform-utm-medium" name="utm_medium" placeholder="cpc"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                    </div>
                    <div>
                      <label htmlFor="campaignform-utm-campaign" className="block text-xs text-slate-600 mb-1">utm_campaign</label>
                      <input id="campaignform-utm-campaign" name="utm_campaign" placeholder="vedanta-jaipur-may25"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Meta IDs (optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="campaignform-meta-campaign-id" className="block text-xs text-slate-600 mb-1">Meta Campaign ID</label>
                      <input id="campaignform-meta-campaign-id" name="meta_campaign_id" placeholder="120210..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                    </div>
                    <div>
                      <label htmlFor="campaignform-meta-adset-id" className="block text-xs text-slate-600 mb-1">Meta Ad Set ID</label>
                      <input id="campaignform-meta-adset-id" name="meta_adset_id" placeholder="120211..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400" />
                    </div>
                  </div>
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
                  {loading ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
      </Modal>
    </>
  )
}
