'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Result = { success: boolean; error?: string }

interface Props {
  label: string
  /** A (bound) server action. Receives the prompted text when `promptLabel` is set. */
  action: (input?: string) => Promise<Result>
  /** Ask for confirmation before running. */
  confirm?: string
  /** Ask for a line of text (e.g. a reason); the action is skipped if left empty. */
  promptLabel?: string
  tone?: 'default' | 'danger' | 'success'
  className?: string
}

const TONES = {
  default: 'border-slate-300 text-slate-700 hover:bg-slate-50',
  danger: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
  success: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
}

/** One-click server action with confirm/prompt and an inline error. */
export default function ActionButton({ label, action, confirm, promptLabel, tone = 'default', className = '' }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run() {
    let input: string | undefined
    if (promptLabel) {
      const answer = window.prompt(promptLabel)
      if (!answer?.trim()) return
      input = answer.trim()
    } else if (confirm && !window.confirm(confirm)) {
      return
    }
    setError(null)
    start(async () => {
      const res = await action(input)
      if (res.success) router.refresh()
      else setError(res.error ?? 'Failed')
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={pending}
        className={`px-3 py-1.5 text-xs font-medium border rounded-lg disabled:opacity-50 ${TONES[tone]} ${className}`}>
        {pending ? 'Working…' : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
