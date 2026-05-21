'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleCareerActive } from '@/lib/website/actions'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  listingId: string
  isActive: boolean
}

export default function CareerActions({ listingId, isActive }: Props) {
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      await toggleCareerActive(listingId, !isActive)
      router.refresh()
    })
  }

  return (
    <button onClick={handleToggle} title={isActive ? 'Deactivate' : 'Activate'}
      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100">
      {isActive ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )
}
