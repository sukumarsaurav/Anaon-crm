'use client'

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import { syncTemplateStatuses } from '@/lib/whatsapp/actions'

/** "Sync status" — pulls Meta's approval verdicts (via AgencyX) into the CRM. */
export default function SyncTemplatesButton({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500 max-w-xs">{msg}</span>}
      <Button
        variant="secondary"
        disabled={!enabled || pending}
        onClick={() =>
          start(async () => {
            const r = await syncTemplateStatuses()
            if (!r.success) return setMsg(r.error ?? 'Sync failed')
            const parts = [`${r.updated} updated`, r.added ? `${r.added} added from AgencyX` : null,
              r.resetToDraft ? `${r.resetToDraft} not on WhatsApp → back to draft` : null].filter(Boolean)
            setMsg(parts.join(' · '))
          })
        }
      >
        <RefreshCw size={16} className={pending ? 'animate-spin' : ''} /> Sync status
      </Button>
    </div>
  )
}
