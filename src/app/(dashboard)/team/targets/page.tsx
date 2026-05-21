'use client'

import { useState, useEffect, useTransition } from 'react'
import { getTeamMembers, getMonthlyTarget } from '@/lib/team/queries'
import SetTargetModal from '@/components/team/SetTargetModal'
import type { TeamMember, TeamTarget } from '@/types/team'
import { formatCurrency } from '@/lib/utils'

export default function TargetsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [members, setMembers] = useState<TeamMember[]>([])
  const [targets, setTargets] = useState<Record<string, TeamTarget | null>>({})
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const mems = await getTeamMembers()
      const advisors = mems.filter((m) => m.role === 'sales_advisor' || m.role === 'telecaller')
      setMembers(advisors)
      const tgtMap: Record<string, TeamTarget | null> = {}
      await Promise.all(
        advisors.map(async (m) => {
          tgtMap[m.id] = await getMonthlyTarget(m.id, month, year)
        })
      )
      setTargets(tgtMap)
    })
  }, [month, year])

  const monthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Targets</h1>
          <p className="text-sm text-slate-500 mt-1">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1.5"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2025, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-1.5"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-700">Advisor</th>
              <th className="text-right px-4 py-3 font-medium text-slate-700">Revenue Target</th>
              <th className="text-right px-4 py-3 font-medium text-slate-700">Bookings</th>
              <th className="text-right px-4 py-3 font-medium text-slate-700">Site Visits</th>
              <th className="text-right px-4 py-3 font-medium text-slate-700">Calls</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">No advisors found</td>
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
                  <td className="px-4 py-3 text-right text-slate-700">
                    {t?.target_bookings ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {t?.target_site_visits ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {t?.target_calls ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(m)}
                      className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium"
                    >
                      {t ? 'Edit' : 'Set Target'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <SetTargetModal
          member={selected}
          existingTarget={targets[selected.id] ?? null}
          month={month}
          year={year}
          onClose={() => {
            setSelected(null)
            // Re-fetch targets for this member
            startTransition(async () => {
              const t = await getMonthlyTarget(selected.id, month, year)
              setTargets((prev) => ({ ...prev, [selected.id]: t }))
            })
          }}
        />
      )}
    </div>
  )
}
