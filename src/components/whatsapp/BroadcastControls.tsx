'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { sendBroadcast, resumeBroadcast, cancelBroadcast } from '@/lib/whatsapp/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export default function BroadcastControls({ id, status, queued }: { id: string; status: string; queued: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const askConfirm = useConfirm()
  const [msg, setMsg] = useState<string | null>(null)

  const run = (fn: () => Promise<{ success: boolean; error?: string } & Record<string, unknown>>) =>
    start(async () => {
      const r = await fn()
      if (!r.success) setMsg(r.error ?? 'Failed')
      else if (typeof r.remaining === 'number' && r.remaining > 0) {
        setMsg(`${r.remaining} still queued${r.rateLimited ? ' (WhatsApp rate limit — try again in a minute)' : ''} — press Continue`)
      } else setMsg(null)
      router.refresh()
    })

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500 max-w-xs">{msg}</span>}
      {(status === 'draft' || status === 'scheduled') && (
        <Button disabled={pending} onClick={() => run(() => sendBroadcast(id))}>
          {pending ? 'Sending…' : 'Send now'}
        </Button>
      )}
      {status === 'sending' && queued > 0 && (
        <Button disabled={pending} onClick={() => run(() => resumeBroadcast(id))}>
          {pending ? 'Sending…' : `Continue (${queued} left)`}
        </Button>
      )}
      {['draft', 'scheduled', 'sending'].includes(status) && (
        <Button variant="ghost" disabled={pending} onClick={async () => {
          if (await askConfirm({ title: 'Cancel broadcast', message: 'Cancel this broadcast? Queued messages will not be sent.', confirmLabel: 'Cancel broadcast' })) run(() => cancelBroadcast(id))
        }}>
          Cancel
        </Button>
      )}
    </div>
  )
}
