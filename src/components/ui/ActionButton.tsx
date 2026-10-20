'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from './ConfirmDialog'
import { usePrompt } from './PromptDialog'
import { useToast } from './Toast'

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
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
}

/** One-click server action with confirm/prompt and an inline error. */
export default function ActionButton({ label, action, confirm, promptLabel, tone = 'default', className = '' }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const askConfirm = useConfirm()
  const askPrompt = usePrompt()
  const toast = useToast()

  async function run() {
    let input: string | undefined
    if (promptLabel) {
      const answer = await askPrompt(promptLabel, { title: label })
      if (!answer) return
      input = answer
    } else if (confirm && !(await askConfirm({ title: label, message: confirm, confirmLabel: label, tone: tone === 'danger' ? 'danger' : 'primary' }))) {
      return
    }
    setError(null)
    start(async () => {
      const res = await action(input)
      if (res.success) {
        toast.success(`${label}: done`)
        router.refresh()
      } else {
        setError(res.error ?? 'Failed')
        toast.error(res.error ?? `${label} failed`)
      }
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
