'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { SOURCE_LABELS } from '@/types/leads'
import type { LeadSource } from '@/types/leads'
import type { AssignmentRuleInput, AssignmentRuleRow } from '@/lib/leads/assignmentRules'
import {
  createAssignmentRule,
  updateAssignmentRule,
  deleteAssignmentRule,
  toggleAssignmentRule,
} from '@/lib/leads/assignmentRules'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'

interface Advisor {
  id: string
  full_name: string
  role: string
}

const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: 'plotted_development', label: 'Plot' },
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
]

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS) as [LeadSource, string][]

function emptyDraft(): AssignmentRuleInput {
  return {
    name: '',
    priority: 100,
    is_active: true,
    match_sources: [],
    match_property_types: [],
    match_cities: [],
    budget_min: null,
    budget_max: null,
    assign_mode: 'round_robin',
    assign_to: null,
    assign_pool: [],
  }
}

function ruleToDraft(r: AssignmentRuleRow): AssignmentRuleInput {
  return {
    name: r.name,
    priority: r.priority,
    is_active: r.is_active,
    match_sources: r.match_sources ?? [],
    match_property_types: r.match_property_types ?? [],
    match_cities: r.match_cities ?? [],
    budget_min: r.budget_min,
    budget_max: r.budget_max,
    assign_mode: r.assign_mode,
    assign_to: r.assign_to,
    assign_pool: r.assign_pool ?? [],
  }
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300',
      )}
    >
      {label}
    </button>
  )
}

function conditionSummary(r: AssignmentRuleRow): string {
  const parts: string[] = []
  if (r.match_sources?.length) parts.push(`source: ${r.match_sources.map((s) => SOURCE_LABELS[s] ?? s).join(', ')}`)
  if (r.match_property_types?.length) parts.push(`type: ${r.match_property_types.join(', ')}`)
  if (r.match_cities?.length) parts.push(`city: ${r.match_cities.join(', ')}`)
  if (r.budget_min != null || r.budget_max != null) {
    parts.push(`budget: ${r.budget_min ?? '0'}–${r.budget_max ?? '∞'}`)
  }
  return parts.length ? parts.join(' · ') : 'Any lead'
}

export default function AssignmentRulesManager({
  initialRules,
  advisors,
}: {
  initialRules: AssignmentRuleRow[]
  advisors: Advisor[]
}) {
  const [editing, setEditing] = useState<AssignmentRuleRow | 'new' | null>(null)
  const [draft, setDraft] = useState<AssignmentRuleInput>(emptyDraft())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const advisorName = (id: string | null) =>
    advisors.find((a) => a.id === id)?.full_name ?? '—'

  const openNew = () => {
    setDraft(emptyDraft())
    setError(null)
    setEditing('new')
  }
  const openEdit = (r: AssignmentRuleRow) => {
    setDraft(ruleToDraft(r))
    setError(null)
    setEditing(r)
  }

  const toggleInArray = (key: 'match_sources' | 'match_property_types' | 'assign_pool', value: string) => {
    setDraft((d) => {
      const arr = (d[key] as string[] | null) ?? []
      return { ...d, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] }
    })
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res =
        editing === 'new'
          ? await createAssignmentRule(draft)
          : await updateAssignmentRule((editing as AssignmentRuleRow).id, draft)
      if (res.success) setEditing(null)
      else setError(res.error ?? 'Failed to save')
    })
  }

  const remove = (id: string) => {
    if (!confirm('Delete this rule?')) return
    startTransition(() => {
      void deleteAssignmentRule(id)
    })
  }

  const toggle = (r: AssignmentRuleRow) => {
    startTransition(() => {
      void toggleAssignmentRule(r.id, !r.is_active)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus size={16} />
          Add Rule
        </Button>
      </div>

      {initialRules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">No rules yet</p>
          <p className="text-sm text-slate-500 mt-1">
            All leads currently round-robin across active advisors. Add a rule to route by area,
            type, budget, or source.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialRules.map((r) => (
            <div
              key={r.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-white p-3.5',
                r.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60',
              )}
            >
              <GripVertical size={16} className="text-slate-300 shrink-0" />
              <span className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                {r.priority}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{r.name}</p>
                <p className="text-xs text-slate-500 truncate">{conditionSummary(r)}</p>
              </div>
              <div className="shrink-0 text-right hidden sm:block">
                <p className="text-xs text-slate-400">Assign</p>
                <p className="text-sm font-medium text-slate-700">
                  {r.assign_mode === 'specific'
                    ? advisorName(r.assign_to)
                    : `Round-robin${r.assign_pool?.length ? ` (${r.assign_pool.length})` : ''}`}
                </p>
              </div>
              <label className="shrink-0 inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={r.is_active}
                  onChange={() => toggle(r)}
                  disabled={isPending}
                  className="sr-only peer"
                />
                <span className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-indigo-600 relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
              <button
                onClick={() => openEdit(r)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => remove(r.id)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New Assignment Rule' : 'Edit Assignment Rule'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={save} loading={isPending} disabled={!draft.name.trim()}>
              Save Rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Rule name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Jaipur villas → Priya"
            />
            <Input
              label="Priority"
              type="number"
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
              hint="Lower runs first"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Match sources <span className="text-slate-400 font-normal">(any if none)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  active={(draft.match_sources ?? []).includes(value)}
                  onClick={() => toggleInArray('match_sources', value)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Match property types <span className="text-slate-400 font-normal">(any if none)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_TYPES.map((t) => (
                <Chip
                  key={t.value}
                  label={t.label}
                  active={(draft.match_property_types ?? []).includes(t.value)}
                  onClick={() => toggleInArray('match_property_types', t.value)}
                />
              ))}
            </div>
          </div>

          <Input
            label="Match cities (comma-separated, any if blank)"
            value={(draft.match_cities ?? []).join(', ')}
            onChange={(e) =>
              setDraft({ ...draft, match_cities: e.target.value.split(',').map((c) => c.trim()).filter(Boolean) })
            }
            placeholder="Jaipur, Jodhpur"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Budget min"
              type="number"
              value={draft.budget_min ?? ''}
              onChange={(e) => setDraft({ ...draft, budget_min: e.target.value ? Number(e.target.value) : null })}
              placeholder="any"
            />
            <Input
              label="Budget max"
              type="number"
              value={draft.budget_max ?? ''}
              onChange={(e) => setDraft({ ...draft, budget_max: e.target.value ? Number(e.target.value) : null })}
              placeholder="any"
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Select
              label="Assign to"
              value={draft.assign_mode}
              onChange={(e) =>
                setDraft({ ...draft, assign_mode: e.target.value as 'specific' | 'round_robin' })
              }
              options={[
                { value: 'round_robin', label: 'Round-robin (least loaded)' },
                { value: 'specific', label: 'A specific advisor' },
              ]}
            />

            {draft.assign_mode === 'specific' ? (
              <div className="mt-3">
                <Select
                  label="Advisor"
                  placeholder="Select an advisor"
                  value={draft.assign_to ?? ''}
                  onChange={(e) => setDraft({ ...draft, assign_to: e.target.value || null })}
                  options={advisors.map((a) => ({ value: a.id, label: a.full_name }))}
                />
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700 mb-1.5">
                  Round-robin pool <span className="text-slate-400 font-normal">(all advisors if none)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {advisors.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.full_name}
                      active={(draft.assign_pool ?? []).includes(a.id)}
                      onClick={() => toggleInArray('assign_pool', a.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
