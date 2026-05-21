'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Phone, Shield, RefreshCw } from 'lucide-react'

export default function OtpLoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/portal/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to send OTP')
      return
    }

    setStep('otp')
    if (data.otp) setDevOtp(data.otp) // dev mode only
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/portal/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Verification failed')
      return
    }

    router.push('/client-portal')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-2xl">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ANON INDIA</h1>
          <p className="text-indigo-300 mt-1 text-sm">Client Portal</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-2xl">
          {step === 'phone' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Sign in</h2>
              <p className="text-indigo-200 text-sm mb-6">Enter your registered mobile number to receive a one-time password</p>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-indigo-200 block mb-1.5">Mobile Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="98765 43210"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <><RefreshCw size={16} className="animate-spin" /> Sending...</> : 'Send OTP'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Enter OTP</h2>
              <p className="text-indigo-200 text-sm mb-2">
                A 6-digit OTP was sent to <span className="font-semibold text-white">{phone}</span>
              </p>

              {devOtp && (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2 mb-4">
                  <p className="text-xs text-amber-300">Dev mode — OTP: <span className="font-bold text-white">{devOtp}</span></p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-indigo-200 block mb-1.5">6-Digit OTP</label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      placeholder="• • • • • •"
                      maxLength={6}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm tracking-widest text-center"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <><RefreshCw size={16} className="animate-spin" /> Verifying...</> : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); setError(null); setDevOtp(null) }}
                  className="w-full text-indigo-300 hover:text-white text-sm py-1"
                >
                  ← Change number
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-indigo-400/60 text-xs mt-6">
          ANON INDIA · Client Portal · Secure Access
        </p>
      </div>
    </div>
  )
}
