'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { sendBroadcast, resumeBroadcast, cancelBroadcast, retryFailedBroadcast } from '@/lib/whatsapp/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Props {
  id: string
  status: string
  /** Recipients still waiting to be sent (exact count). */
  queued: number
  /** Failed sends a retry can fix (outages, timeouts — not opt-outs or missing values). */
  retryable: number
}

type RunResult = {
  success: boolean
  error?: string
  remaining?: number
  rateLimited?: boolean
  paused?: string
}

const RATE_LIMIT_WAIT_MS = 60_000
const OUTAGE_WAIT_MS = 120_000

/**
 * Send / Continue / Retry / Cancel. While this page is open a sending broadcast keeps going
 * by itself (batch after batch, waiting out rate limits); the 5-minute cron carries it on
 * when nobody is watching.
 */
export default function BroadcastControls({ id, status, queued, retryable }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const askConfirm = useConfirm()
  const [msg, setMsg] = useState<string | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const running = useRef(false)
  // Follows the server: each batch refreshes the page, and the loop ends when nothing is queued.
  const auto = status === 'sending' && queued > 0 && !userPaused

  useEffect(() => {
    if (!auto) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      if (stopped || running.current) return
      running.current = true
      let r: RunResult
      try {
        r = await resumeBroadcast(id)
      } catch {
        r = { success: false, error: 'Lost connection - will try again' }
      } finally {
        running.current = false
      }
      if (stopped) return
      router.refresh()
      if (!r.success) {
        setMsg(r.error ?? 'Failed')
        timer = setTimeout(tick, OUTAGE_WAIT_MS)
        return
      }
      if (!r.remaining) {
        setMsg(null)
        return
      }
      if (r.paused) {
        setMsg(`Paused: ${r.paused}. Retrying in 2 minutes.`)
        timer = setTimeout(tick, OUTAGE_WAIT_MS)
      } else if (r.rateLimited) {
        setMsg(`${r.remaining} left - WhatsApp rate limit, continuing in a minute.`)
        timer = setTimeout(tick, RATE_LIMIT_WAIT_MS)
      } else {
        setMsg(`${r.remaining} left - sending…`)
        timer = setTimeout(tick, 500)
      }
    }

    timer = setTimeout(tick, 500)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [auto, id, router])

  const run = (fn: () => Promise<RunResult & Record<string, unknown>>) =>
    start(async () => {
      const r = await fn()
      if (!r.success) setMsg(r.error ?? 'Failed')
      else if (typeof r.remaining === 'number' && r.remaining > 0) {
        setMsg(`${r.remaining} still queued - sending continues while this page is open`)
        setUserPaused(false)
      } else setMsg(null)
      router.refresh()
    })

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {msg && <span role="status" className="text-xs text-slate-500 max-w-xs">{msg}</span>}
      {(status === 'draft' || status === 'scheduled') && (
        <Button disabled={pending} onClick={() => run(() => sendBroadcast(id))}>
          {pending ? 'Sending…' : 'Send now'}
        </Button>
      )}
      {status === 'queueing' && <span className="text-xs text-slate-500">Preparing the audience…</span>}
      {status === 'sending' && queued > 0 && (
        auto ? (
          <Button variant="ghost" onClick={() => { setUserPaused(true); setMsg('Auto-send paused on this page (the background job still continues every 5 minutes).') }}>
            Pause auto-send
          </Button>
        ) : (
          <Button disabled={pending} onClick={() => { setUserPaused(false); setMsg(null) }}>
            {pending ? 'Sending…' : `Continue (${queued} left)`}
          </Button>
        )
      )}
      {(status === 'sending' || status === 'sent') && retryable > 0 && (
        <Button variant="ghost" disabled={pending} onClick={async () => {
          if (await askConfirm({ title: 'Retry failed messages', message: `Re-send the ${retryable} message(s) that failed to send? Opt-outs and missing values are not retried.`, confirmLabel: 'Retry' })) run(() => retryFailedBroadcast(id))
        }}>
          Retry failed ({retryable})
        </Button>
      )}
      {['draft', 'scheduled', 'sending'].includes(status) && (
        <Button variant="ghost" disabled={pending} onClick={async () => {
          if (await askConfirm({ title: 'Cancel broadcast', message: 'Cancel this broadcast? Queued messages will not be sent.', confirmLabel: 'Cancel broadcast' })) {
            setUserPaused(true)
            run(() => cancelBroadcast(id))
          }
        }}>
          Cancel
        </Button>
      )}
    </div>
  )
}
