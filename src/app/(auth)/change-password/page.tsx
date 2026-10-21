'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Lock, Eye, EyeOff } from 'lucide-react'
import { passwordProblem, MIN_PASSWORD_LENGTH } from '@/lib/security/passwordPolicy'

const fieldCls = 'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pl-10 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm'

/**
 * Accounts created with a temporary password (Add junior, broker portal access, admin reset) land
 * here until they choose their own — the proxy sends every other page here while the flag is set.
 * Also reachable any time to change your password.
 */
export default function ChangePasswordPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const password = String(fd.get('password') ?? '')
    const confirm = String(fd.get('confirm') ?? '')
    const problem = passwordProblem(password)
    if (problem) { setError(problem); return }
    if (password !== confirm) { setError('The two passwords don’t match'); return }
    setError(null)

    startTransition(async () => {
      let res: Response
      try {
        res = await fetch('/api/auth/change-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
        })
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
        return
      }
      const payload: { redirectTo?: string; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) { router.replace('/login'); return }
        setError(payload.error ?? 'Could not change the password')
        return
      }
      router.replace(payload.redirectTo ?? '/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-2xl">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ANON INDIA</h1>
          <p className="text-primary-300 mt-1 text-sm">Real Estate CRM</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-2xl">
          <h2 className="text-xl font-semibold text-white">Choose your password</h2>
          <p className="text-sm text-primary-200 mt-1 mb-6">
            New and reset accounts must replace their temporary password before continuing. Use at least {MIN_PASSWORD_LENGTH} characters, with letters and numbers.
          </p>

          {error && (
            <div role="alert" className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(['password', 'confirm'] as const).map((name) => (
              <div key={name}>
                <label htmlFor={`cp-${name}`} className="text-sm font-medium text-primary-200 block mb-1.5">
                  {name === 'password' ? 'New password' : 'Confirm new password'}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300" />
                  <input id={`cp-${name}`} name={name} type={show ? 'text' : 'password'} autoComplete="new-password"
                    required minLength={MIN_PASSWORD_LENGTH} className={fieldCls} />
                  {name === 'password' && (
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300 hover:text-white">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button type="submit" disabled={isPending}
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 rounded-xl transition-colors mt-2 disabled:opacity-60">
              {isPending ? 'Saving…' : 'Save and continue'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6">
          <a href="/api/auth/signout" className="text-primary-300/70 hover:text-white">Sign out</a>
        </p>
      </div>
    </div>
  )
}
