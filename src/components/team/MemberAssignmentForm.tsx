'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changeStaffAssignment } from '@/lib/team/staff'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales_advisor', label: 'Sales advisor' },
  { value: 'telecaller', label: 'Telecaller' },
]

interface Props {
  memberId: string
  role: string
  branchId: string | null
  teamId: string | null
  branches: { id: string; name: string }[]
  teams: { id: string; name: string }[]
}

/** Admin-only: role, branch and team for a member (the only place these can be changed). */
export default function MemberAssignmentForm({ memberId, role, branchId, teamId, branches, teams }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await changeStaffAssignment(memberId, {
        role: fd.get('role') as string,
        branch_id: (fd.get('branch_id') as string) || null,
        team_id: (fd.get('team_id') as string) || null,
      })
      if (!res.success) { setError(res.error ?? 'Could not save'); return }
      toast.success('Role and team saved')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
      <Select name="role" label="Role" defaultValue={role} options={ROLE_OPTIONS} />
      <Select name="branch_id" label="Branch" defaultValue={branchId ?? ''}
        options={[{ value: '', label: 'No branch' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]} />
      <Select name="team_id" label="Team" defaultValue={teamId ?? ''}
        options={[{ value: '', label: 'No team' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
      <Button type="submit" size="md" loading={pending}>Save</Button>
      {error && <p role="alert" className="sm:col-span-4 text-sm text-red-600">{error}</p>}
    </form>
  )
}
