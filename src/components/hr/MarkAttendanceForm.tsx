'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markAttendance } from '@/lib/team/actions'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ATTENDANCE_STATUS_CONFIG, type AttendanceStatus } from '@/types/team'

interface Props {
  employees: { id: string; full_name: string }[]
  defaultDate: string
}

/** Manager correction: mark someone present / absent / on leave for a day. */
export default function MarkAttendanceForm({ employees, defaultDate }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const userId = fd.get('user_id') as string
    if (!userId) { setError('Choose an employee'); return }
    setError(null)
    startTransition(async () => {
      const res = await markAttendance(userId, fd.get('date') as string, fd.get('status') as AttendanceStatus, (fd.get('notes') as string) || undefined)
      if (!res.success) { setError(res.error ?? 'Could not save'); return }
      toast.success('Attendance saved')
      form.reset()
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
      <Select name="user_id" label="Employee" placeholder="Choose…"
        options={employees.map((e) => ({ value: e.id, label: e.full_name }))} />
      <Input name="date" type="date" label="Date" defaultValue={defaultDate} required />
      <Select name="status" label="Status" defaultValue="present"
        options={(Object.keys(ATTENDANCE_STATUS_CONFIG) as AttendanceStatus[]).map((s) => ({ value: s, label: ATTENDANCE_STATUS_CONFIG[s].label }))} />
      <Input name="notes" label="Note" placeholder="Optional" />
      <Button type="submit" loading={pending}>Mark attendance</Button>
      {error && <p role="alert" className="sm:col-span-5 text-sm text-red-600">{error}</p>}
    </form>
  )
}
