'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCampaignStatus } from '@/lib/marketing/actions'
import type { CampaignStatus } from '@/types/marketing'

interface Props {
  campaignId: string
  status: CampaignStatus
}

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
]

export default function CampaignStatusToggle({ campaignId, status }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [value, setValue] = useState<CampaignStatus>(status)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as CampaignStatus
    const previous = value
    setValue(next)
    setError(null)
    start(async () => {
      const result = await updateCampaignStatus(campaignId, next)
      if (!result.success) {
        // Show what is actually saved, not what was picked.
        setValue(previous)
        setError(result.error ?? 'Could not change status')
        return
      }
      router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select aria-label="Campaign status"
        value={value}
        onChange={handleChange}
        disabled={pending}
        className={`text-xs rounded-full px-2 py-0.5 border font-medium focus:outline-none disabled:opacity-60 ${
          value === 'active'    ? 'border-green-300 text-green-700 bg-green-50' :
          value === 'paused'    ? 'border-amber-300 text-amber-700 bg-amber-50' :
          value === 'completed' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                  'border-slate-300 text-slate-500 bg-slate-50'
        }`}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
