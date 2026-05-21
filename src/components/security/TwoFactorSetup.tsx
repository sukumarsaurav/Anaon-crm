'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldX, QrCode, KeyRound, Copy, Check } from 'lucide-react'

interface Props {
  enabled: boolean
  userId: string
}

function CopySecretButton({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function TwoFactorSetup({ enabled, userId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'qr' | 'verify'>('idle')
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEnabled, setIsEnabled] = useState(enabled)

  async function startEnroll() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/2fa/enroll', { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setQrUri(data.uri)
    setSecret(data.secret)
    setStep('qr')
  }

  async function verifyCode() {
    if (code.length !== 6) return
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); setCode(''); return }
    setIsEnabled(true)
    setStep('idle')
    router.refresh()
  }

  async function handleDisable() {
    if (!confirm('Disable two-factor authentication? This reduces your account security.')) return
    setLoading(true)
    const res = await fetch('/api/auth/2fa/disable', { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      setIsEnabled(false)
      router.refresh()
    }
  }

  // Generate QR code image from otpauth URI using a local canvas approach
  const qrApiUrl = qrUri
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUri)}&size=200x200`
    : ''

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            {isEnabled
              ? <><ShieldCheck size={18} className="text-green-600" /> Two-Factor Authentication</>
              : <><ShieldX size={18} className="text-slate-400" /> Two-Factor Authentication</>
            }
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEnabled
              ? 'Your account is protected with TOTP-based 2FA.'
              : 'Add an extra layer of security with Google Authenticator or Authy.'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {isEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {step === 'idle' && (
        isEnabled ? (
          <button
            onClick={handleDisable}
            disabled={loading}
            className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Disable 2FA
          </button>
        ) : (
          <button
            onClick={startEnroll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <QrCode size={15} /> Enable 2FA
          </button>
        )
      )}

      {step === 'qr' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-semibold mb-1">Step 1: Scan QR Code</p>
            <p>Open <strong>Google Authenticator</strong> or <strong>Authy</strong> and scan this QR code:</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrApiUrl} alt="QR Code" width={200} height={200} className="rounded-lg border border-slate-200 mx-auto" />
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">Or enter this key manually:</p>
              <CopySecretButton secret={secret} />
            </div>
            <code className="text-xs font-mono text-slate-800 break-all">{secret}</code>
          </div>
          <button onClick={() => setStep('verify')}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            I've scanned the code →
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-semibold mb-1">Step 2: Verify Setup</p>
            <p>Enter the 6-digit code from your authenticator app to confirm setup:</p>
          </div>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 pl-9 text-center text-xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Confirm & Enable'}
            </button>
            <button onClick={() => { setStep('idle'); setCode('') }}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
