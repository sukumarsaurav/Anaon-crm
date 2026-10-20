'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FileUrlInput from '@/components/ui/FileUrlInput'
import Button from '@/components/ui/Button'

interface Props {
  bookingId: string
  hasAgreement: boolean
  /** Bound server action that stores the link and marks the agreement signed. */
  save: (url?: string) => Promise<{ success: boolean; error?: string }>
}

/** Upload (or link) the signed agreement. It used to be a pasted URL in a prompt box only. */
export default function AgreementUploadForm({ bookingId, hasAgreement, save }: Props) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="w-full space-y-2">
      <FileUrlInput name="agreement_url" label={hasAgreement ? 'Replace signed agreement' : 'Signed agreement'}
        folder="bookings" scopeId={bookingId} accept="application/pdf,image/jpeg,image/png" onChange={setUrl} />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <Button size="sm" variant="success" disabled={!url.trim()} loading={pending}
        onClick={() => startTransition(async () => {
          setError(null)
          const res = await save(url.trim())
          if (!res.success) { setError(res.error ?? 'Could not save'); return }
          setUrl('')
          router.refresh()
        })}>
        Save agreement
      </Button>
    </div>
  )
}
