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
            <label htmlFor="projectform-name" className="block text-xs font-medium text-slate-600 mb-1">Project Name *</label>
            <input id="projectform-name" name="name" required defaultValue={p?.name} placeholder="Jaipur Highlands Phase 2"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-type" className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
            <select id="projectform-type" name="type" required defaultValue={p?.type ?? 'plotted_development'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              {Object.entries(PROJECT_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="projectform-status" className="block text-xs font-medium text-slate-600 mb-1">Status *</label>
            <select id="projectform-status" name="status" required defaultValue={p?.status ?? 'pre_launch'}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="projectform-city" className="block text-xs font-medium text-slate-600 mb-1">City *</label>
            <input id="projectform-city" name="city" required defaultValue={p?.city} placeholder="Jaipur"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-locality" className="block text-xs font-medium text-slate-600 mb-1">Locality</label>
            <input id="projectform-locality" name="locality" defaultValue={p?.locality ?? ''} placeholder="Jagatpura"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="projectform-address" className="block text-xs font-medium text-slate-600 mb-1">Full Address</label>
            <input id="projectform-address" name="address" defaultValue={p?.address ?? ''} placeholder="Survey No. 123, Near..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-google-maps-pin" className="block text-xs font-medium text-slate-600 mb-1">Google Maps Pin URL</label>
            <input id="projectform-google-maps-pin" name="google_maps_pin" defaultValue={p?.google_maps_pin ?? ''} placeholder="https://maps.google.com/..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-rera-number" className="block text-xs font-medium text-slate-600 mb-1">RERA Number</label>
            <input id="projectform-rera-number" name="rera_number" defaultValue={p?.rera_number ?? ''} placeholder="RAJ/P/2024/001234"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-launch-date" className="block text-xs font-medium text-slate-600 mb-1">Launch Date</label>
            <input id="projectform-launch-date" name="launch_date" type="date" defaultValue={p?.launch_date ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-expected-completion-date" className="block text-xs font-medium text-slate-600 mb-1">Expected Completion</label>
            <input id="projectform-expected-completion-date" name="expected_completion_date" type="date" defaultValue={p?.expected_completion_date ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-total-units" className="block text-xs font-medium text-slate-600 mb-1">Total Units</label>
            <input id="projectform-total-units" name="total_units" type="number" min="1" defaultValue={p?.total_units ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="projectform-description" className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea id="projectform-description" name="description" rows={3} defaultValue={p?.description ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
        </div>
      </div>

      {/* Team & Contacts */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Team & Contacts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="projectform-legal-contact" className="block text-xs font-medium text-slate-600 mb-1">Legal Contact</label>
            <input id="projectform-legal-contact" name="legal_contact" defaultValue={p?.legal_contact ?? ''} placeholder="Adv. Sharma +91..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-contractor-name" className="block text-xs font-medium text-slate-600 mb-1">Contractor / Builder</label>
            <input id="projectform-contractor-name" name="contractor_name" defaultValue={p?.contractor_name ?? ''} placeholder="ABC Constructions"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Media Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="projectform-layout-image-url" className="block text-xs font-medium text-slate-600 mb-1">Layout Image URL</label>
            <input id="projectform-layout-image-url" name="layout_image_url" defaultValue={p?.layout_image_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-brochure-url" className="block text-xs font-medium text-slate-600 mb-1">Brochure PDF URL</label>
            <input id="projectform-brochure-url" name="brochure_url" defaultValue={p?.brochure_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-price-list-url" className="block text-xs font-medium text-slate-600 mb-1">Price List URL</label>
            <input id="projectform-price-list-url" name="price_list_url" defaultValue={p?.price_list_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-video-url" className="block text-xs font-medium text-slate-600 mb-1">Video Walkthrough URL</label>
            <input id="projectform-video-url" name="video_url" defaultValue={p?.video_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-virtual-tour-url" className="block text-xs font-medium text-slate-600 mb-1">360° Virtual Tour URL</label>
            <input id="projectform-virtual-tour-url" name="virtual_tour_url" defaultValue={p?.virtual_tour_url ?? ''}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div>
          <label htmlFor="projectform-amenities" className="block text-xs font-medium text-slate-600 mb-1">Amenities (one per line)</label>
          <textarea id="projectform-amenities" name="amenities" rows={4} defaultValue={Array.isArray(p?.amenities) ? p.amenities.join('\n') : ''}
            placeholder="Gated Community&#10;24/7 Security&#10;Park & Playground&#10;Wide Internal Roads"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
        </div>
      </div>

      {/* Hold config */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Soft Hold Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="projectform-hold-duration-hours" className="block text-xs font-medium text-slate-600 mb-1">Hold Duration (hours)</label>
            <input id="projectform-hold-duration-hours" name="hold_duration_hours" type="number" min="1" max="168" defaultValue={p?.hold_duration_hours ?? 48}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="projectform-max-holds-per-advisor" className="block text-xs font-medium text-slate-600 mb-1">Max Holds per Advisor</label>
            <input id="projectform-max-holds-per-advisor" name="max_holds_per_advisor" type="number" min="1" max="10" defaultValue={p?.max_holds_per_advisor ?? 3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40">
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
