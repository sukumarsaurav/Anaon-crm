'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleAutomation } from '@/lib/automation/actions'

interface Props { id: string; isActive: boolean }

export default function AutomationToggle({ id, isActive }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleAutomation(id, !isActive)
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-checked={isActive}
      role="switch"
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        isActive ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
  )
}
