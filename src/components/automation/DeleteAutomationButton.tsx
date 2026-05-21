'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAutomation } from '@/lib/automation/actions'
import { Trash2 } from 'lucide-react'

export function DeleteAutomationButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    setLoading(true)
    startTransition(async () => {
      await deleteAutomation(id)
      router.push('/automation')
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        confirm
          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
      }`}
    >
      <Trash2 size={14} />
      {confirm ? 'Confirm Delete' : 'Delete'}
    </button>
  )
}
