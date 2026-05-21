'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClientProfile, updateClientProfile } from '@/lib/clients/actions'
import { OCCUPATION_LABELS } from '@/types/clients'
import type { Client } from '@/types/clients'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

interface Props {
  client?: Client
}

const OCCUPATION_OPTIONS = [
  { value: '', label: '— Select —' },
  ...Object.entries(OCCUPATION_LABELS).map(([v, label]) => ({ value: v, label })),
]

export default function ClientForm({ client }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = client
        ? await updateClientProfile(client.id, formData)
        : await createClientProfile(formData)
      if (result.success) {
        router.push('id' in result ? `/clients/${result.id}` : `/clients/${client!.id}`)
      } else {
        setError((result as { error?: string }).error ?? 'Failed')
      }
    })
  }

  const c = client

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Personal Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input name="full_name" label="Full Name" required defaultValue={c?.full_name} />
          </div>
          <Input name="phone" label="Primary Phone" required defaultValue={c?.phone} placeholder="+91 9876543210" />
          <Input name="alternate_phone" label="Alternate Phone" defaultValue={c?.alternate_phone ?? ''} />
          <Input name="email" label="Email" type="email" defaultValue={c?.email ?? ''} />
          <Input name="date_of_birth" label="Date of Birth" type="date" defaultValue={c?.date_of_birth ?? ''} />
          <Input name="pan" label="PAN Number" defaultValue={c?.pan_encrypted ?? ''} placeholder="ABCDE1234F" />
          <Input name="aadhar" label="Aadhar Number" defaultValue={c?.aadhar_encrypted ?? ''} placeholder="XXXX XXXX XXXX" />
          <div className="sm:col-span-2">
            <Textarea name="permanent_address" label="Permanent Address" rows={2} defaultValue={c?.permanent_address ?? ''} />
          </div>
          <div className="sm:col-span-2">
            <Textarea name="communication_address" label="Communication Address (if different)" rows={2} defaultValue={c?.communication_address ?? ''} />
          </div>
          <Input name="photo_url" label="Photo URL" defaultValue={c?.photo_url ?? ''} placeholder="https://..." />
        </div>
      </div>

      {/* Professional */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Professional Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select name="occupation_type" label="Occupation" defaultValue={c?.occupation_type ?? ''} options={OCCUPATION_OPTIONS} />
          <Input name="company_name" label="Company / Business Name" defaultValue={c?.company_name ?? ''} />
          <Input name="monthly_income" label="Monthly Income (₹)" type="number" min={0} defaultValue={c?.monthly_income ?? ''} />
          <Input name="annual_income" label="Annual Income (₹)" type="number" min={0} defaultValue={c?.annual_income ?? ''} />
        </div>
      </div>

      {/* Co-applicant */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Co-applicant (if any)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input name="co_applicant_name" label="Full Name" defaultValue={c?.co_applicant_name ?? ''} />
          <Input name="co_applicant_relationship" label="Relationship" defaultValue={c?.co_applicant_relationship ?? ''} placeholder="Spouse, Parent..." />
          <Input name="co_applicant_phone" label="Phone" defaultValue={c?.co_applicant_phone ?? ''} />
        </div>
      </div>

      {/* Nominee */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Nominee Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input name="nominee_name" label="Nominee Name" defaultValue={c?.nominee_name ?? ''} />
          <Input name="nominee_relationship" label="Relationship" defaultValue={c?.nominee_relationship ?? ''} />
          <Input name="nominee_dob" label="Date of Birth" type="date" defaultValue={c?.nominee_dob ?? ''} />
          <Input name="nominee_phone" label="Phone" defaultValue={c?.nominee_phone ?? ''} />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-3">
        <Button type="submit" loading={isPending} disabled={isPending}>
          {isPending ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
