'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import { initiateLeadCall } from '@/lib/telephony/actions'

/**
 * Click-to-call: triggers a server-side Exotel call (rings the agent, then the
 * lead). Falls back to a tel: link error message if telephony isn't configured.
 */
export default function ClickToCallButton({ leadId }: { leadId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleCall() {
    setLoading(true)
    setMsg(null)
    const res = await initiateLeadCall(leadId)
    setLoading(false)
    if (res.success) {
      setMsg('Calling you now — pick up to connect.')
      router.refresh()
      setTimeout(() => setMsg(null), 6000)
    } else {
      setMsg(res.error ?? 'Call failed')
      setTimeout(() => setMsg(null), 6000)
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={handleCall} disabled={loading}>
        {loading ? <RefreshCw size={16} className="animate-spin" /> : <PhoneCall size={16} />} Call
      </Button>
      {msg && (
        <p className="absolute top-full left-0 mt-1 w-56 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg shadow-lg px-2.5 py-1.5 z-20">
          {msg}
        </p>
      )}
    </div>
  )
}
