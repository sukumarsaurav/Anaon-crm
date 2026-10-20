'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveBroker, rejectBroker, deactivateBroker, grantBrokerPortalAccess } from '@/lib/brokers/actions'

interface Props {
  brokerId: string
  status: string
  hasPortalAccess?: boolean
}

export default function BrokerApprovalPanel({ brokerId, status, hasPortalAccess = false }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'reject'>('idle')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)

  async function handleGrantAccess() {
    setLoading(true)
    setAccessError(null)
    startTransition(async () => {
      const res = await grantBrokerPortalAccess(brokerId)
      if (res.success) setCreds({ email: res.email, tempPassword: res.tempPassword })
      else setAccessError(res.error)
      router.refresh()
      setLoading(false)
    })
  }

  async function handleApprove() {
    setLoading(true)
    startTransition(async () => {
      await approveBroker(brokerId)
      router.refresh()
      setLoading(false)
    })
  }

  async function handleReject() {
    if (!reason.trim()) return
    setLoading(true)
    startTransition(async () => {
      await rejectBroker(brokerId, reason.trim())
      router.refresh()
      setLoading(false)
      setMode('idle')
    })
  }

  async function handleDeactivate() {
    if (!confirm('Deactivate this broker?')) return
    setLoading(true)
    startTransition(async () => {
      await deactivateBroker(brokerId)
      router.refresh()
      setLoading(false)
    })
  }

  if (status === 'pending') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-semibold text-amber-800 mb-3">Pending Approval</h3>
        {mode === 'idle' ? (
          <div className="flex gap-3">
            <button onClick={handleApprove} disabled={loading}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
              Approve Broker
            </button>
            <button onClick={() => setMode('reject')} disabled={loading}
              className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100">
              Reject
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for rejection..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={loading || !reason.trim()}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
                Confirm Rejection
              </button>
              <button onClick={() => setMode('idle')} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="space-y-3">
        {creds ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-green-800">Portal login created — share these now</p>
            <p className="text-green-900">Email: <span className="font-mono">{creds.email}</span></p>
            <p className="text-green-900">Temporary password: <span className="font-mono select-all">{creds.tempPassword}</span></p>
            <p className="text-xs text-green-700">Shown only once. The broker signs in at the normal login page and lands in the broker portal.</p>
          </div>
        ) : hasPortalAccess ? (
          <p className="text-sm text-slate-500">Portal login: active</p>
        ) : (
          <div>
            <button onClick={handleGrantAccess} disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
              Create portal login
            </button>
            {accessError && <p className="mt-2 text-sm text-red-600">{accessError}</p>}
          </div>
        )}
        <button onClick={handleDeactivate} disabled={loading}
          className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
          Deactivate Broker
        </button>
      </div>
    )
  }

  return null
}
