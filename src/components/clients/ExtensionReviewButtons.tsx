'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reviewExtensionRequest } from '@/lib/portal/actions'

export default function ExtensionReviewButtons({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function review(status: 'approved' | 'rejected') {
    const notes = status === 'rejected' ? (window.prompt('Reason for rejecting (shown in the record):') ?? '') : undefined
    if (status === 'rejected' && !notes?.trim()) return
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const res = await reviewExtensionRequest(requestId, status, notes?.trim())
      setLoading(false)
      if (res.success) router.refresh()
      else setError(res.error ?? 'Failed')
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button onClick={() => review('approved')} disabled={loading}
          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
          Approve &amp; move date
        </button>
        <button onClick={() => review('rejected')} disabled={loading}
          className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50">
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
