'use client'

import { useState, startTransition } from 'react'
import { approveCommissionBatch, markCommissionPaidBatch } from '@/lib/brokers/actions'
import { formatCurrency } from '@/lib/utils'
import type { BrokerCommissionRow } from '@/types/brokers'
import { COMMISSION_STATUS_CONFIG } from '@/types/bookings'
import type { CommissionStatus } from '@/types/bookings'

interface Props {
  commissions: BrokerCommissionRow[]
}

export default function CommissionBatchPanel({ commissions }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [utr, setUtr] = useState('')
  const [loading, setLoading] = useState(false)

  const pending  = commissions.filter((c) => c.status === 'pending')
  const approved = commissions.filter((c) => c.status === 'approved')

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const selectAll = (rows: BrokerCommissionRow[]) =>
    setSelected(new Set(rows.map((r) => r.id)))

  const clearAll = () => setSelected(new Set())

  const selectedPending  = [...selected].filter((id) => pending.find((p) => p.id === id))
  const selectedApproved = [...selected].filter((id) => approved.find((a) => a.id === id))

  const totalSelected = commissions
    .filter((c) => selected.has(c.id))
    .reduce((a, c) => a + (c.commission_amount ?? 0), 0)

  async function handleApprove() {
    if (!selectedPending.length) return
    setLoading(true)
    startTransition(async () => {
      await approveCommissionBatch(selectedPending)
      setSelected(new Set())
      setLoading(false)
    })
  }

  async function handleMarkPaid() {
    if (!selectedApproved.length || !utr.trim()) return
    setLoading(true)
    startTransition(async () => {
      await markCommissionPaidBatch(selectedApproved, utr.trim())
      setSelected(new Set())
      setUtr('')
      setLoading(false)
    })
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-indigo-800">
            {selected.size} selected · {formatCurrency(totalSelected)}
          </p>
          <div className="flex-1" />
          {selectedPending.length > 0 && (
            <button onClick={handleApprove} disabled={loading}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Approve ({selectedPending.length})
            </button>
          )}
          {selectedApproved.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="UTR number"
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400"
              />
              <button onClick={handleMarkPaid} disabled={loading || !utr.trim()}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                Mark Paid ({selectedApproved.length})
              </button>
            </div>
          )}
          <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700">Clear</button>
        </div>
      )}

      {/* Select all shortcuts */}
      <div className="flex gap-3 text-xs">
        <button onClick={() => selectAll(pending)} className="text-amber-600 hover:underline">
          Select all pending ({pending.length})
        </button>
        <button onClick={() => selectAll(approved)} className="text-blue-600 hover:underline">
          Select all approved ({approved.length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Broker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Booking</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Booking Value</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Commission</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">UTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {commissions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No commissions found</td></tr>
            )}
            {commissions.map((c) => {
              const cfg = COMMISSION_STATUS_CONFIG[c.status as CommissionStatus]
              return (
                <tr key={c.id} className={selected.has(c.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    {['pending','approved'].includes(c.status) && (
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                        className="rounded border-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {c.broker?.full_name}
                    {c.broker?.firm_name && <span className="text-slate-400 text-xs"> · {c.broker.firm_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.booking?.booking_number ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(c.booking_value)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                    {formatCurrency(c.commission_amount ?? 0)}
                    {c.commission_pct && <span className="text-xs text-slate-400 ml-1">({c.commission_pct}%)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color} ${cfg?.bg}`}>
                      {cfg?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.utr_number ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
