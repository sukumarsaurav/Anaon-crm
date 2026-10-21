'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SetTargetModal from '@/components/team/SetTargetModal'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import type { TeamMember, TeamTarget } from '@/types/team'

interface Props {
  members: TeamMember[]
  targets: Record<string, TeamTarget | null>
  month: number
  year: number
  /** Opens the editor for this member (the "Set Target" link on a member's page). */
  initialMemberId?: string
}

export default function TargetsTable({ members, targets, month, year, initialMemberId }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<TeamMember | null>(() => members.find((m) => m.id === initialMemberId) ?? null)

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th scope="col" className="text-left px-4 py-3 font-medium text-slate-700">Advisor</th>
              <th scope="col" className="text-right px-4 py-3 font-medium text-slate-700">Revenue Target</th>
              <th scope="col" className="text-right px-4 py-3 font-medium text-slate-700">Bookings</th>
              <th scope="col" className="text-right px-4 py-3 font-medium text-slate-700">Site Visits</th>
              <th scope="col" className="text-right px-4 py-3 font-medium text-slate-700">Calls</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="p-0"><EmptyState title="No advisors found" description="Targets are set for the advisors and telecallers in the teams you lead." className="py-8" /></td>
              </tr>
            )}
            {members.map((m) => {
              const t = targets[m.id]
              return (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.full_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{m.role.replace('_', ' ')}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {t ? formatCurrency(t.target_revenue) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{t?.target_bookings ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{t?.target_site_visits ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{t?.target_calls ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(m)}
                      className="text-xs px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 font-medium">
                      {t ? 'Edit' : 'Set Target'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>

      {selected && (
        <SetTargetModal
          member={selected}
          existingTarget={targets[selected.id] ?? null}
          month={month}
          year={year}
          onClose={() => { setSelected(null); router.refresh() }}
        />
      )}
    </>
  )
}
