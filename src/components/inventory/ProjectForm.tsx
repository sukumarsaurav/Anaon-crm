'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProject, updateProject } from '@/lib/inventory/actions'
import { PROJECT_TYPE_LABELS } from '@/types/inventory'
import type { Project } from '@/types/inventory'

interface Props {
  project?: Project
}

const PROJECT_STATUSES = [
  { value: 'pre_launch',         label: 'Pre-Launch' },
  { value: 'launched',           label: 'Launched' },
  { value: 'under_construction', label: 'Under Construction' },
  { value: 'ready_to_move',      label: 'Ready to Move' },
  { value: 'sold_out',           label: 'Sold Out' },
]

export default function ProjectForm({ project }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = project
        ? await updateProject(project.id, formData)
        : await createProject(formData)
      if (result.success) {
        router.push(project ? `/inventory/${project.id}` : `/inventory/${'id' in result ? result.id : ''}`)
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  const p = project

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Basic Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Project Name *</label>
            <input name="name" required defaultValue={p?.name} placeholder="Jaipur Highlands Phase 2"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
            <select name="type" required defaultValue={p?.type ?? 'plotted_development'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(PROJECT_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status *</label>
            <select name="status" required defaultValue={p?.status ?? 'pre_launch'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">City *</label>
            <input name="city" required defaultValue={p?.city} placeholder="Jaipur"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Locality</label>
            <input name="locality" defaultValue={p?.locality ?? ''} placeholder="Jagatpura"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Address</label>
            <input name="address" defaultValue={p?.address ?? ''} placeholder="Survey No. 123, Near..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Google Maps Pin URL</label>
            <input name="google_maps_pin" defaultValue={p?.google_maps_pin ?? ''} placeholder="https://maps.google.com/..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">RERA Number</label>
            <input name="rera_number" defaultValue={p?.rera_number ?? ''} placeholder="RAJ/P/2024/001234"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Launch Date</label>
            <input name="launch_date" type="date" defaultValue={p?.launch_date ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Expected Completion</label>
            <input name="expected_completion_date" type="date" defaultValue={p?.expected_completion_date ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Total Units</label>
            <input name="total_units" type="number" min="1" defaultValue={p?.total_units ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea name="description" rows={3} defaultValue={p?.description ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
      </div>

      {/* Team & Contacts */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Team & Contacts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Legal Contact</label>
            <input name="legal_contact" defaultValue={p?.legal_contact ?? ''} placeholder="Adv. Sharma +91..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contractor / Builder</label>
            <input name="contractor_name" defaultValue={p?.contractor_name ?? ''} placeholder="ABC Constructions"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Media Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Layout Image URL</label>
            <input name="layout_image_url" defaultValue={p?.layout_image_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Brochure PDF URL</label>
            <input name="brochure_url" defaultValue={p?.brochure_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price List URL</label>
            <input name="price_list_url" defaultValue={p?.price_list_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Video Walkthrough URL</label>
            <input name="video_url" defaultValue={p?.video_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">360° Virtual Tour URL</label>
            <input name="virtual_tour_url" defaultValue={p?.virtual_tour_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amenities (one per line)</label>
          <textarea name="amenities" rows={4} defaultValue={Array.isArray(p?.amenities) ? p.amenities.join('\n') : ''}
            placeholder="Gated Community&#10;24/7 Security&#10;Park & Playground&#10;Wide Internal Roads"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
      </div>

      {/* Hold config */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Soft Hold Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hold Duration (hours)</label>
            <input name="hold_duration_hours" type="number" min="1" max="168" defaultValue={p?.hold_duration_hours ?? 48}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max Holds per Advisor</label>
            <input name="max_holds_per_advisor" type="number" min="1" max="10" defaultValue={p?.max_holds_per_advisor ?? 3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40">
          {isPending ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
