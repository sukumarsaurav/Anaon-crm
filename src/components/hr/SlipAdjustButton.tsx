'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePayrollSlip } from '@/lib/hr/actions'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface Props {
  slipId: string
  name: string
  presentDays: number
  workingDays: number
  incentives: number
}

/** Admin: correct present days (loss of pay) and incentives on a slip of an open run. */
export default function SlipAdjustButton({ slipId, name, presentDays, workingDays, incentives }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await updatePayrollSlip(slipId, fd)
      if (!res.success) { setError(res.error ?? 'Could not save'); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>Adjust</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Adjust slip — ${name}`} size="sm">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input name="working_days" type="number" min={1} max={31} label="Working days" defaultValue={workingDays} required />
            <Input name="present_days" type="number" min={0} max={31} label="Present days" defaultValue={presentDays} required />
          </div>
          <Input name="incentives" type="number" min={0} step="1" label="Incentives (₹)" defaultValue={incentives} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
