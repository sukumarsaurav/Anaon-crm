'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Copy, Check } from 'lucide-react'
import { resetStaffPassword } from '@/lib/team/staff'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

/** Admin: issue a temporary password. It is shown once; the person must replace it at sign-in. */
export default function ResetPasswordButton({ employeeId, name }: { employeeId: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const [temp, setTemp] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const askConfirm = useConfirm()
  const toast = useToast()

  async function onClick() {
    if (!(await askConfirm({
      title: `Reset ${name}'s password?`,
      message: 'They are signed out everywhere and must choose a new password the next time they sign in.',
      confirmLabel: 'Reset password',
    }))) return
    startTransition(async () => {
      const res = await resetStaffPassword(employeeId)
      if (!res.success || !res.tempPassword) { toast.error(res.error ?? 'Could not reset the password'); return }
      setTemp(res.tempPassword)
    })
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={onClick} loading={pending}><KeyRound size={14} /> Reset password</Button>
      <Modal open={!!temp} onClose={() => { setTemp(null); setCopied(false) }} title="Temporary password" size="sm">
        <p className="text-sm text-slate-600">Give this to {name}. It is shown only once, and they must change it when they sign in.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono text-slate-900">{temp}</code>
          <Button size="sm" variant="secondary" aria-label="Copy password"
            onClick={async () => { await navigator.clipboard.writeText(temp ?? ''); setCopied(true) }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      </Modal>
    </>
  )
}
