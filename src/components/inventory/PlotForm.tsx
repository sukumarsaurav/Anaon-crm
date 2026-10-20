'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPlot, updatePlot } from '@/lib/inventory/actions'
import { formatCurrency } from '@/lib/utils'
import type { Plot } from '@/types/inventory'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

interface Props {
  projectId: string
  plot?: Plot
  /** Project premium matrix (percent by premium type): pre-fills a new plot's premiums from its type. */
  premiumDefaults?: Partial<Record<string, number>>
}

const PLOT_TYPE_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'corner', label: 'Corner' },
  { value: 'park_facing', label: 'Park Facing' },
  { value: 'road_facing', label: 'Road Facing' },
]

const FACING_OPTIONS = [
  { value: '', label: '— Select —' },
  ...['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west'].map(f => ({
    value: f, label: f.replace('_', '-').toUpperCase(),
  })),
]

const STATUS_OPTIONS = ['available', 'soft_hold', 'booked', 'registered', 'sold', 'not_for_sale'].map(s => ({
  value: s, label: s.replace('_', ' '),
}))

export default function PlotForm({ projectId, plot, premiumDefaults = {} }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [basePrice, setBasePrice] = useState(plot?.base_price ?? 0)
  const [premiums, setPremiums] = useState({
    corner: plot?.corner_premium ?? 0,
    facing: plot?.facing_premium ?? 0,
    other:  plot?.other_premium ?? 0,
    dev:    plot?.development_charges ?? 0,
  })

  // Same formula as the database's generated total_price: corner and facing premiums are PERCENT of
  // the base price, other premium and development charges are rupees. The form used to label all of
  // them ₹ and add them, so "₹50,000 corner premium" was stored as 50,000 % of the base price.
  const total = basePrice * (1 + premiums.corner / 100 + premiums.facing / 100) + premiums.other + premiums.dev

  function onTypeChange(type: string) {
    if (plot) return // never overwrite an existing plot's premiums
    setPremiums((p) => ({
      ...p,
      corner: type === 'corner' ? premiumDefaults.corner ?? p.corner : 0,
      facing: type === 'park_facing' || type === 'road_facing' ? premiumDefaults[type] ?? p.facing : 0,
    }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('project_id', projectId)
    setError(null)
    startTransition(async () => {
      const result = plot
        ? await updatePlot(plot.id, formData)
        : await createPlot(formData)
      if (result.success) {
        router.push(`/inventory/${projectId}`)
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Input name="plot_number" label="Plot Number" required defaultValue={plot?.plot_number} placeholder="A-101" />
        <Select name="type" label="Type" defaultValue={plot?.type ?? 'regular'} options={PLOT_TYPE_OPTIONS} onChange={(e) => onTypeChange(e.target.value)} />
        <Input name="size_sqyd" label="Size (sq yards)" type="number" step={0.01} defaultValue={plot?.size_sqyd ?? ''} />
        <Input name="size_sqft" label="Size (sq ft)" type="number" step={0.01} defaultValue={plot?.size_sqft ?? ''} />
        <Select name="facing" label="Facing" defaultValue={plot?.facing ?? ''} options={FACING_OPTIONS} />
        <Input name="configuration" label="Configuration" defaultValue={plot?.configuration ?? ''} placeholder="2BHK / 3BHK / Plot" />
        {plot && (
          <Select name="status" label="Status" defaultValue={plot.status} options={STATUS_OPTIONS} />
        )}
      </div>

      {/* Pricing */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Pricing</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'base_price',          label: 'Base Price (₹)',     required: true,  val: basePrice,       setter: setBasePrice },
            { name: 'corner_premium',      label: 'Corner Premium (% of base)', required: false, val: premiums.corner, setter: (v: number) => setPremiums(p => ({ ...p, corner: v })) },
            { name: 'facing_premium',      label: 'Facing Premium (% of base)', required: false, val: premiums.facing, setter: (v: number) => setPremiums(p => ({ ...p, facing: v })) },
            { name: 'other_premium',       label: 'Other Premium (₹)',  required: false, val: premiums.other,  setter: (v: number) => setPremiums(p => ({ ...p, other: v })) },
            { name: 'development_charges', label: 'Dev. Charges (₹)',   required: false, val: premiums.dev,    setter: (v: number) => setPremiums(p => ({ ...p, dev: v })) },
          ].map(({ name, label, required, val, setter }) => (
            <Input
              key={name}
              name={name}
              label={label}
              type="number"
              min={0}
              step={1}
              required={required}
              value={val || ''}
              onChange={(e) => setter(parseFloat(e.target.value) || 0)}
            />
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold text-slate-800 pt-2 border-t border-slate-200">
          <span>Total Price</span>
          <span className="text-primary-700">{formatCurrency(total, { mode: 'exact' })}</span>
        </div>
      </div>

      <Textarea name="notes" label="Notes" rows={2} defaultValue={plot?.notes ?? ''} />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-3">
        <Button type="submit" loading={isPending} disabled={isPending}>
          {isPending ? 'Saving...' : plot ? 'Update Plot' : 'Add Plot'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
