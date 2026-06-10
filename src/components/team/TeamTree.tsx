'use client'

import { useMemo, useState, useTransition } from 'react'
import { UserPlus, Crown, ChevronRight, Network, Check, Copy } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { addJunior } from '@/lib/team/teams'
import type { TeamsData, TeamRow, MemberRow } from '@/types/team'
import { getInitials, cn } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', sales_advisor: 'Sales Advisor', telecaller: 'Telecaller',
}

export default function TeamTree({ data }: { data: TeamsData }) {
  const { teams, members, viewer, manageableTeamIds } = data
  const [addFor, setAddFor] = useState<TeamRow | null>(null)

  const childrenOf = useMemo(() => {
    const m = new Map<string, TeamRow[]>()
    for (const t of teams) {
      if (t.parent_team_id) {
        const arr = m.get(t.parent_team_id) ?? []
        arr.push(t); m.set(t.parent_team_id, arr)
      }
    }
    return m
  }, [teams])

  const membersOf = useMemo(() => {
    const m = new Map<string, MemberRow[]>()
    for (const p of members) {
      if (p.team_id) { const arr = m.get(p.team_id) ?? []; arr.push(p); m.set(p.team_id, arr) }
    }
    return m
  }, [members])

  // Roots: admin → top-level teams; leader → teams they directly lead.
  const roots = useMemo(() => {
    if (viewer.role === 'admin') return teams.filter((t) => !t.parent_team_id)
    return teams.filter((t) => t.leader_id === viewer.id)
  }, [teams, viewer])

  const renderTeam = (team: TeamRow, depth: number) => {
    const leader = members.find((m) => m.id === team.leader_id)
    const teamMembers = (membersOf.get(team.id) ?? []).filter((m) => m.id !== team.leader_id)
    const canManage = manageableTeamIds.includes(team.id)
    const kids = childrenOf.get(team.id) ?? []

    return (
      <div key={team.id} className={cn(depth > 0 && 'ml-5 pl-5 border-l border-slate-200')}>
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <Network size={15} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{team.name}</p>
                <p className="text-xs text-slate-500">
                  {leader ? <span className="inline-flex items-center gap-1"><Crown size={11} className="text-amber-500" />{leader.full_name}</span> : 'No leader'}
                  {' · '}{teamMembers.length + (leader ? 1 : 0)} member{teamMembers.length + (leader ? 1 : 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={() => setAddFor(team)}>
                <UserPlus size={14} /> Add Junior
              </Button>
            )}
          </div>

          {/* Members */}
          {(leader || teamMembers.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {leader && <MemberChip m={leader} leader />}
              {teamMembers.map((m) => <MemberChip key={m.id} m={m} />)}
            </div>
          )}
        </div>

        {/* Child teams */}
        {kids.map((k) => renderTeam(k, depth + 1))}
      </div>
    )
  }

  return (
    <>
      {roots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">No teams yet</p>
          <p className="text-sm text-slate-500 mt-1">An admin can create the first team to start the chain.</p>
        </div>
      ) : (
        roots.map((r) => renderTeam(r, 0))
      )}

      {addFor && (
        <AddJuniorModal team={addFor} onClose={() => setAddFor(null)} />
      )}
    </>
  )
}

function MemberChip({ m, leader }: { m: MemberRow; leader?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs',
      leader ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600')}>
      <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-500 overflow-hidden">
        {m.photo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.photo_url} alt="" className="w-full h-full object-cover" /> : getInitials(m.full_name)}
      </span>
      {m.full_name}
      <span className="text-slate-400">· {ROLE_LABEL[m.role] ?? m.role}</span>
    </span>
  )
}

function AddJuniorModal({ team, onClose }: { team: TeamRow; onClose: () => void }) {
  const [mode, setMode] = useState<'member' | 'team'>('member')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; pw: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    setError(null)
    const email = formData.get('email') as string
    startTransition(async () => {
      const res = await addJunior({
        full_name: formData.get('full_name') as string,
        email,
        phone: (formData.get('phone') as string) || undefined,
        role: formData.get('role') as 'manager' | 'sales_advisor' | 'telecaller',
        designation: (formData.get('designation') as string) || undefined,
        target_team_id: team.id,
        mode,
        new_team_name: (formData.get('new_team_name') as string) || undefined,
      })
      if (res.success) setCreated({ email, pw: res.tempPassword ?? '' })
      else setError(res.error ?? 'Failed to add')
    })
  }

  return (
    <Modal open onClose={onClose} title={`Add Junior — ${team.name}`} size="md">
      {created ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
            User created. Share these login credentials:
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
            <p><span className="text-slate-400">Email:</span> <span className="font-medium">{created.email}</span></p>
            <div className="flex items-center justify-between mt-1">
              <p><span className="text-slate-400">Password:</span> <span className="font-mono font-medium">{created.pw}</span></p>
              <button onClick={() => { navigator.clipboard.writeText(`${created.email} / ${created.pw}`); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg">
                {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      ) : (
        <form action={submit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full name" name="full_name" required placeholder="e.g. Karan Mehta" />
            <Input label="Email" name="email" type="email" required placeholder="karan@anonindia.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" name="phone" placeholder="Optional" />
            <Select label="Role" name="role" defaultValue="sales_advisor" options={[
              { value: 'sales_advisor', label: 'Sales Advisor' },
              { value: 'telecaller', label: 'Telecaller' },
              { value: 'manager', label: 'Manager' },
            ]} />
          </div>
          <Input label="Designation" name="designation" placeholder="Optional" />
          <div className="border-t border-slate-100 pt-3">
            <Select label="Add as" value={mode} onChange={(e) => setMode(e.target.value as 'member' | 'team')} options={[
              { value: 'member', label: 'Member of this team' },
              { value: 'team', label: 'Leader of a new junior team' },
            ]} />
            {mode === 'team' && (
              <div className="mt-3"><Input label="Junior team name" name="new_team_name" placeholder={`e.g. Karan's Team`} /></div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" loading={isPending}>Create User</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
