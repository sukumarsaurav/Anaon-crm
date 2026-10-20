'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function subscribe(): Promise<boolean> {
  if (!VAPID) return false
  const reg = await navigator.serviceWorker.register('/sw.js')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID),
  })
  const res = await fetch('/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'web', subscription: sub }),
  })
  return res.ok
}

/**
 * Registers browser push. Subscribes silently when permission is already
 * granted; otherwise shows a small "Enable alerts" prompt (never auto-prompts).
 */
export default function PushRegistrar() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!VAPID) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'granted') {
      subscribe().catch(() => {})
    } else if (Notification.permission === 'default') {
      setShow(true)
    }
  }, [])

  async function handleEnable() {
    setBusy(true)
    const perm = await Notification.requestPermission()
    if (perm === 'granted') await subscribe().catch(() => {})
    setBusy(false)
    setShow(false)
  }

  if (!show) return null

  return (
    <button
      onClick={handleEnable}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60"
      title="Get desktop alerts for new leads, reminders and payments"
      aria-label="Enable alerts"
    >
      <Bell size={13} /> <span className="hidden sm:inline">{busy ? 'Enabling…' : 'Enable alerts'}</span>
    </button>
  )
}
