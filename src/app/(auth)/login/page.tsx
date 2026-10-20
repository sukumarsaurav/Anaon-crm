'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Set after mount (not in the initial state) so the server and client render the same HTML.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reason') === 'deactivated') {
      setError('This account has been deactivated. Contact an administrator.')
    }
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    setError(null)

    startTransition(async () => {
      // Lockout check, sign-in, and audit recording all happen server-side so
      // they cannot be skipped — see src/app/api/auth/login/route.ts.
      let res: Response
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
        return
      }

      let payload: { redirectTo?: string; error?: string } = {}
      try {
        payload = await res.json()
      } catch { /* non-JSON response */ }

      if (!res.ok) {
        setError(payload.error ?? 'Login failed. Please try again.')
        return
      }

      router.replace(payload.redirectTo ?? '/')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-2xl">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ANON INDIA</h1>
          <p className="text-primary-300 mt-1 text-sm">Real Estate CRM</p>
        </div>

        {/* Form */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-primary-200 block mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@anonIndia.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pl-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-primary-200 block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pl-10 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 rounded-xl transition-colors mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-400/60 text-xs mt-6">
          ANON INDIA CRM · Internal Portal
        </p>
      </div>
    </div>
  )
}
