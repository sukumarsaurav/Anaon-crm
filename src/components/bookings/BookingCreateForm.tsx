'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBooking } from '@/lib/bookings/actions'
import { formatCurrency } from '@/lib/utils'
import { PAYMENT_PLAN_LABELS, REFERRED_BY_LABELS } from '@/types/bookings'
import type { PaymentPlanType, ReferredBySource } from '@/types/bookings'

interface Client { id: string; full_name: string; phone: string }
interface Project { id: string; name: string; city: string }
interface Plot { id: string; plot_number: string; size_sqyd: number | null; type: string; facing: string | null; total_price: number | null; base_price: number }
interface Broker { id: string; full_name: string; firm_name: string | null; commission_rate: number }
interface Advisor { id: string; full_name: string }

interface Props {
  clients:  Client[]
  projects: Project[]
  advisors: Advisor[]
  brokers:  Broker[]
}

export default function BookingCreateForm({ clients, projects, advisors, brokers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [projectId,      setProjectId]    = useState('')
  const [plots,          setPlots]        = useState<Plot[]>([])
  const [selectedPlot,   setSelectedPlot] = useState<Plot | null>(null)
  const [loadingPlots,   setLoadingPlots] = useState(false)
  const [totalValue,     setTotalValue]   = useState(0)
  const [brokerId,       setBrokerId]     = useState('')
  const [brokerCommPct,  setBrokerCommPct]= useState(0)

  // Fetch available plots when project changes
  useEffect(() => {
    if (!projectId) { setPlots([]); setSelectedPlot(null); return }
    setLoadingPlots(true)
    fetch(`/api/inventory/available-plots?project_id=${projectId}`)
      .then((r) => r.json())
      .then((data) => { setPlots(data ?? []); setLoadingPlots(false) })
      .catch(() => setLoadingPlots(false))
  }, [projectId])

  useEffect(() => {
    if (selectedPlot) setTotalValue(selectedPlot.total_price ?? selectedPlot.base_price)
  }, [selectedPlot])

  useEffect(() => {
    if (!brokerId) { setBrokerCommPct(0); return }
    const broker = brokers.find((b) => b.id === brokerId)
    setBrokerCommPct(broker?.commission_rate ?? 0)
  }, [brokerId, brokers])

  const commissionAmount = totalValue && brokerCommPct
    ? Math.round((totalValue * brokerCommPct) / 100)
    : 0

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (selectedPlot) fd.set('plot_id', selectedPlot.id)
    setError(null)
    startTransition(async () => {
      const result = await createBooking(fd)
      if (result.success && 'id' in result) {
        router.push(`/bookings/${result.id}`)
      } else {
        setError((result as { error?: string }).error ?? 'Failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Client + Property */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Client & Property</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
            <select name="client_id" required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
            <select name="project_id" required value={projectId} onChange={(e) => { setProjectId(e.target.value); setSelectedPlot(null) }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.city}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Plot *</label>
            {loadingPlots ? (
              <div className="px-3 py-2 text-sm text-slate-400 border border-slate-300 rounded-lg">Loading plots...</div>
            ) : (
              <select required value={selectedPlot?.id ?? ''}
                onChange={(e) => setSelectedPlot(plots.find((p) => p.id === e.target.value) ?? null)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!projectId || plots.length === 0}>
                <option value="">— Select plot —</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plot_number} · {p.type} {p.size_sqyd ? `· ${p.size_sqyd} sq yd` : ''} · {formatCurrency(p.total_price ?? p.base_price)}
                  </option>
                ))}
              </select>
            )}
            {selectedPlot && (
              <p className="text-xs text-green-600 mt-1">
                Plot price: {formatCurrency(selectedPlot.total_price ?? selectedPlot.base_price)}
                {selectedPlot.facing ? ` · ${selectedPlot.facing.replace('_','-').toUpperCase()}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Financials */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Financials & Payment Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Total Sale Value (₹) *</label>
            <input name="total_sale_value" type="number" min="1" required
              value={totalValue || ''}
              onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Booking Amount (₹) *</label>
            <input name="booking_amount" type="number" min="1" required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Plan Type</label>
            <select name="payment_plan_type" defaultValue="custom"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(PAYMENT_PLAN_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Plan Notes</label>
            <input name="payment_plan" placeholder="e.g. 50:50, 10:90..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Booking Date *</label>
            <input name="booking_date" type="date" required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expected Possession</label>
            <input name="expected_possession_date" type="date"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Section 3: Team & Source */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Team & Source</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sales Advisor</label>
            <select name="advisor_id"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Self —</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lead Source</label>
            <select name="referred_by_source"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Select —</option>
              {Object.entries(REFERRED_BY_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Channel Partner (Broker)</label>
            <select name="broker_id" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— None —</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name}{b.firm_name ? ` (${b.firm_name})` : ''} · {b.commission_rate}%
                </option>
              ))}
            </select>
            {brokerId && commissionAmount > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Commission: {brokerCommPct}% = {formatCurrency(commissionAmount)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input name="notes" placeholder="Any special terms or observations"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending || !selectedPlot}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
          {isPending ? 'Creating...' : 'Submit Booking'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
