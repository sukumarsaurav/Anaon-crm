'use client'

import { startTransition } from 'react'
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

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(async () => {
      await updateCampaignStatus(campaignId, e.target.value)
      router.refresh()
    })
  }

  return (
    <select
      defaultValue={status}
      onChange={handleChange}
      className={`text-xs rounded-full px-2 py-0.5 border font-medium focus:outline-none ${
        status === 'active'    ? 'border-green-300 text-green-700 bg-green-50' :
        status === 'paused'    ? 'border-amber-300 text-amber-700 bg-amber-50' :
        status === 'completed' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                 'border-slate-300 text-slate-500 bg-slate-50'
      }`}
    >
      {STATUS_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
