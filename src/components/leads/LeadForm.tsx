'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createLead, updateLead } from '@/lib/leads/actions'
import { checkDuplicate } from '@/lib/leads/queries'
import type { Lead, Project, DuplicateCheck } from '@/types/leads'
import { SOURCE_LABELS } from '@/types/leads'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import DuplicateAlert from './DuplicateAlert'
import { Card } from '@/components/ui/Card'

interface LeadFormProps {
  lead?: Lead
  projects: Project[]
  advisors: { id: string; full_name: string }[]
  onSuccess?: (id: string) => void
}

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))

const PURPOSE_OPTIONS = [
  { value: 'investment', label: 'Investment' },
  { value: 'self_use', label: 'Self Use' },
  { value: 'rental', label: 'Rental Income' },
]

const TIMELINE_OPTIONS = [
  { value: 'immediate', label: 'Immediately' },
  { value: '3_months', label: 'Within 3 Months' },
  { value: '6_months', label: 'Within 6 Months' },
  { value: '1_year_plus', label: '1 Year+' },
]

const PROPERTY_TYPE_OPTIONS = [
  { value: 'plotted_development', label: 'Plot' },
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
]

const CONTACT_METHOD_OPTIONS = [
  { value: 'call', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
]

export default function LeadForm({ lead, projects, advisors, onSuccess }: LeadFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [duplicate, setDuplicate] = useState<DuplicateCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proceedDespiteDuplicate, setProceedDespiteDuplicate] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const isEditing = !!lead

  const handlePhoneBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const phone = e.target.value.replace(/\s/g, '')
    if (phone.length >= 10 && !proceedDespiteDuplicate) {
      const result = await checkDuplicate(phone, undefined, lead?.id)
      if (result.found) {
        setDuplicate(result)
      } else {
        setDuplicate(null)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (duplicate?.found && !proceedDespiteDuplicate) return

    const formData = new FormData(e.currentTarget)
    setError(null)

    startTransition(async () => {
      if (isEditing) {
        const result = await updateLead(lead.id, {
          full_name: formData.get('full_name') as string,
          phone: (formData.get('phone') as string)?.replace(/\s/g, ''),
          alternate_phone: (formData.get('alternate_phone') as string) || null,
          email: (formData.get('email') as string) || null,
          city: (formData.get('city') as string) || null,
          locality: (formData.get('locality') as string) || null,
          project_id: (formData.get('project_id') as string) || null,
          property_type: (formData.get('property_type') as string) || null,
          budget_min: formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
          budget_max: formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
          configuration: (formData.get('configuration') as string) || null,
          purpose: (formData.get('purpose') as Lead['purpose']) || null,
          timeline: (formData.get('timeline') as Lead['timeline']) || null,
          source: formData.get('source') as Lead['source'],
          preferred_contact_method: (formData.get('preferred_contact_method') as string) || null,
          preferred_contact_time: (formData.get('preferred_contact_time') as string) || null,
        })
        if (result.success) {
          onSuccess?.(lead.id)
          router.push(`/leads/${lead.id}`)
        } else {
          setError(result.error ?? 'Failed to update lead')
        }
      } else {
        const result = await createLead(formData)
        if (result.success && result.id) {
          onSuccess?.(result.id)
          router.push(`/leads/${result.id}`)
        } else {
          setError(result.error ?? 'Failed to create lead')
        }
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {duplicate?.found && !proceedDespiteDuplicate && (
        <DuplicateAlert
          duplicate={duplicate}
          onContinue={() => {
            setProceedDespiteDuplicate(true)
            setDuplicate(null)
          }}
          onCancel={() => {
            setDuplicate(null)
            router.back()
          }}
        />
      )}

      {/* Basic Information */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="full_name"
            required
            placeholder="e.g. Rahul Sharma"
            defaultValue={lead?.full_name}
          />
          <Input
            label="Primary Mobile"
            name="phone"
            required
            type="tel"
            placeholder="e.g. 9876543210"
            defaultValue={lead?.phone}
            onBlur={handlePhoneBlur}
          />
          <Input
            label="Alternate Mobile"
            name="alternate_phone"
            type="tel"
            placeholder="Optional"
            defaultValue={lead?.alternate_phone ?? ''}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="Optional"
            defaultValue={lead?.email ?? ''}
          />
          <Input
            label="City"
            name="city"
            placeholder="e.g. Jaipur"
            defaultValue={lead?.city ?? ''}
          />
          <Input
            label="Locality / Area"
            name="locality"
            placeholder="e.g. Vaishali Nagar"
            defaultValue={lead?.locality ?? ''}
          />
        </div>
      </Card>

      {/* Interest Details */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Interest Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Interested Project"
            name="project_id"
            placeholder="Select project"
            options={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.city})` }))}
            defaultValue={lead?.project_id ?? ''}
          />
          <Select
            label="Property Type"
            name="property_type"
            placeholder="Select type"
            options={PROPERTY_TYPE_OPTIONS}
            defaultValue={lead?.property_type ?? ''}
          />
          <div className="flex gap-3">
            <Input
              label="Budget Min (₹)"
              name="budget_min"
              type="number"
              placeholder="e.g. 2000000"
              defaultValue={lead?.budget_min?.toString() ?? ''}
            />
            <Input
              label="Budget Max (₹)"
              name="budget_max"
              type="number"
              placeholder="e.g. 4000000"
              defaultValue={lead?.budget_max?.toString() ?? ''}
            />
          </div>
          <Input
            label="Configuration"
            name="configuration"
            placeholder="e.g. 2BHK, 200 sq yd"
            defaultValue={lead?.configuration ?? ''}
          />
          <Select
            label="Purpose"
            name="purpose"
            placeholder="Select purpose"
            options={PURPOSE_OPTIONS}
            defaultValue={lead?.purpose ?? ''}
          />
          <Select
            label="Timeline to Buy"
            name="timeline"
            placeholder="Select timeline"
            options={TIMELINE_OPTIONS}
            defaultValue={lead?.timeline ?? ''}
          />
        </div>
      </Card>

      {/* Lead Source */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Lead Source</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Source"
            name="source"
            required
            options={SOURCE_OPTIONS}
            defaultValue={lead?.source ?? 'manual'}
          />
          <Input
            label="Campaign Name"
            name="campaign_name"
            placeholder="e.g. Jaipur Spring 2026"
            defaultValue={lead?.campaign_name ?? ''}
          />
          <Input
            label="UTM Source"
            name="utm_source"
            placeholder="e.g. facebook"
            defaultValue={lead?.utm_source ?? ''}
          />
          <Input
            label="UTM Campaign"
            name="utm_campaign"
            placeholder="e.g. greenville-jaipur-may"
            defaultValue={lead?.utm_campaign ?? ''}
          />
        </div>
      </Card>

      {/* Follow-up Preferences */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Follow-up Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Preferred Contact Method"
            name="preferred_contact_method"
            placeholder="Any"
            options={CONTACT_METHOD_OPTIONS}
            defaultValue={lead?.preferred_contact_method ?? ''}
          />
          <Input
            label="Preferred Contact Time"
            name="preferred_contact_time"
            placeholder="e.g. Evenings after 6 PM"
            defaultValue={lead?.preferred_contact_time ?? ''}
          />
        </div>
      </Card>

      {/* Assignment (admin/manager only in real app) */}
      {!isEditing && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Assignment</h3>
          <Select
            label="Assign To"
            name="assigned_to"
            placeholder="Auto (Round-robin)"
            options={advisors.map((a) => ({ value: a.id, label: a.full_name }))}
          />
          <p className="text-xs text-slate-500 mt-2">
            Leave blank to auto-assign via round-robin.
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isEditing ? 'Save Changes' : 'Create Lead'}
        </Button>
      </div>
    </form>
  )
}
