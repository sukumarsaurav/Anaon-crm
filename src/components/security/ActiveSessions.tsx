'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, Smartphone, LogOut } from 'lucide-react'
import { revokeSession } from '@/lib/security/actions'

interface Session {
  id: string
  session_id: string
  device_info: string | null
  ip_address: string | null
  last_active_at: string
  created_at: string
}

interface Props {
  sessions: Session[]
  currentUserId: string
  targetUserId?: string
}

function isMobile(deviceInfo: string | null) {
  if (!deviceInfo) return false
  return /mobile|android|iphone|ipad/i.test(deviceInfo)
}

export default function ActiveSessions({ sessions, currentUserId, targetUserId }: Props) {
  const router = useRouter()
  const [revoking, setRevoking] = useState<string | null>(null)

  function handleRevoke(sessionId: string) {
    setRevoking(sessionId)
    startTransition(async () => {
      await revokeSession(sessionId, targetUserId)
      setRevoking(null)
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="font-semibold text-slate-900 mb-4">Active Sessions ({sessions.length})</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const mobile = isMobile(s.device_info)
            const lastActive = new Date(s.last_active_at).toLocaleString('en-IN')
            const created = new Date(s.created_at).toLocaleString('en-IN')
            return (
              <div key={s.id} className="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {mobile ? <Smartphone size={16} className="text-slate-500" /> : <Monitor size={16} className="text-slate-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {mobile ? 'Mobile Device' : 'Desktop Browser'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={s.device_info ?? ''}>
                      {s.device_info?.slice(0, 60) ?? 'Unknown device'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      IP: {s.ip_address ?? '—'} · Started {created}
                    </p>
                    <p className="text-xs text-slate-400">Last active: {lastActive}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={revoking === s.id}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                >
                  <LogOut size={12} />
                  {revoking === s.id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
