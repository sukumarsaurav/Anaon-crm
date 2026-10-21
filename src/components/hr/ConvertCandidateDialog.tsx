'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check } from 'lucide-react'
import { convertCandidateToEmployee } from '@/lib/hr/actions'
import { todayIST } from '@/lib/datetime'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'

export interface ConvertCandidate {
  id: string
  name: string
  phone: string
  email: string | null
  offer_ctc: number | null
}

interface Props {
  candidate: ConvertCandidate
  teams: { id: string; name: string }[]
  viewerRole: string
  onClose: () => void
}

const ROLES = [
  { value: 'telecaller', label: 'Telecaller', rank: 1 },
  { value: 'sales_advisor', label: 'Sales Advisor', rank: 2 },
  { value: 'manager', label: 'Manager', rank: 3 },
]
const RANK: Record<string, number> = { telecaller: 1, sales_advisor: 2, manager: 3, admin: 4 }

/** "Joined": create the CRM login from the application. The temporary password is shown once. */
export default function ConvertCandidateDialog({ candidate, teams, viewerRole, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ pw: string; employeeId: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const roles = ROLES.filter((r) => r.rank <= (RANK[viewerRole] ?? 0))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await convertCandidateToEmployee(candidate.id, fd)
      if (!res.success || !('tempPassword' in res)) { setError(res.error ?? 'Could not create the login'); return }
      setCreated({ pw: res.tempPassword ?? '', employeeId: res.employeeId ?? '' })
      router.refresh()
    })
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Employee created" size="sm">
        <p className="text-sm text-slate-600">
          {candidate.name} can now sign in. Share this temporary password — it is shown only once and must be changed at the first sign-in.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono text-slate-900">{created.pw}</code>
          <Button size="sm" variant="secondary" aria-label="Copy password"
            onClick={async () => { await navigator.clipboard.writeText(created.pw); setCopied(true) }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" href={`/hr/employees/${created.employeeId}`}>Open HR record</Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={`Create employee — ${candidate.name}`} size="lg">
      {teams.length === 0 ? (
        <p className="text-sm text-slate-600">
          You don’t lead a team to add them to. An admin can create the login, or make you a team leader under Team → Teams.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input name="full_name" label="Name" required defaultValue={candidate.name} />
            <Input name="email" label="Login email" type="email" required defaultValue={candidate.email ?? ''} />
            <Input name="phone" label="Phone" defaultValue={candidate.phone} />
            <Input name="joining_date" label="Joining date" type="date" required defaultValue={todayIST()} />
            <Select name="role" label="Role" defaultValue={roles.some((r) => r.value === 'sales_advisor') ? 'sales_advisor' : roles[0]?.value}
              options={roles.map(({ value, label }) => ({ value, label }))} />
            <Select name="team_id" label="Team" defaultValue={teams[0].id} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
            <Input name="designation" label="Designation" placeholder="e.g. Sales Executive" />
            <Input name="department" label="Department" placeholder="e.g. Sales" />
            <Input name="base_salary" label="Monthly base salary (₹)" type="number" min="0"
              defaultValue={candidate.offer_ctc ? String(Math.round(candidate.offer_ctc / 12)) : ''}
              hint={candidate.offer_ctc ? 'Offer CTC ÷ 12' : undefined} />
            <Input name="employee_id" label="Employee ID" placeholder="Next EMP-#### if empty" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={pending}>Create login</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
