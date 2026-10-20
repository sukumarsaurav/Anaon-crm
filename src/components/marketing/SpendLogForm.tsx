'use client'

import { todayIST } from '@/lib/datetime'
import { useState, startTransition, useId } from 'react'
import { useRouter } from 'next/navigation'
import { logCampaignSpend } from '@/lib/marketing/actions'
import { PlusCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

interface Props {
  campaignId: string
  campaignName: string
}

const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400'

export default function SpendLogForm({ campaignId, campaignName }: Props) {
  const uid = useId()
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = todayIST()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await logCampaignSpend(formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to log spend')
      } else {
        if (result.replaced) toast.success(`Replaced the spend already logged for ${formData.get('log_date')}`)
        form.reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium"
      >
        <PlusCircle size={13} /> Log spend
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Log spend · ${campaignName}`} size="sm">

            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="campaign_id" value={campaignId} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${uid}-log-date`} className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input id={`${uid}-log-date`} name="log_date" type="date" required defaultValue={today} max={today} className={INPUT} />
                </div>
                <div>
                  <label htmlFor={`${uid}-spend`} className="block text-sm font-medium text-slate-700 mb-1">Spend (₹) <span className="text-red-500">*</span></label>
                  <input id={`${uid}-spend`} name="spend" type="number" required min="0" step="0.01" placeholder="0" className={INPUT} />
                </div>
                <div>
                  <label htmlFor={`${uid}-impressions`} className="block text-sm font-medium text-slate-700 mb-1">Impressions</label>
                  <input id={`${uid}-impressions`} name="impressions" type="number" min="0" placeholder="0" className={INPUT} />
                </div>
                <div>
                  <label htmlFor={`${uid}-clicks`} className="block text-sm font-medium text-slate-700 mb-1">Clicks</label>
                  <input id={`${uid}-clicks`} name="clicks" type="number" min="0" placeholder="0" className={INPUT} />
                </div>
                <div>
                  <label htmlFor={`${uid}-reach`} className="block text-sm font-medium text-slate-700 mb-1">Reach</label>
                  <input id={`${uid}-reach`} name="reach" type="number" min="0" placeholder="0" className={INPUT} />
                </div>
              </div>
              <p className="text-xs text-slate-400">One entry per day: logging a day that already has spend replaces it.</p>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-xl hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
      </Modal>
    </>
  )
}
