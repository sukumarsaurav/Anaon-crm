'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil } from 'lucide-react'
import { saveListing } from '@/lib/hr/listings'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

export interface Opening {
  id: string; title: string; department: string; employment_type: string; location: string
  description: string; requirements: string | null; is_active: boolean
}

const TYPES = [
  { value: 'full_time', label: 'Full time' }, { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' }, { value: 'internship', label: 'Internship' },
]

export default function OpeningForm({ opening }: { opening?: Opening }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const r = await saveListing(fd, opening?.id)
      if (!r.success) { setError(r.error ?? 'Could not save'); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {opening
        ? <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Pencil size={13} /> Edit</Button>
        : <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> New opening</Button>}
      <Modal open={open} onClose={() => setOpen(false)} title={opening ? 'Edit opening' : 'New opening'} size="lg">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input name="title" label="Job title" required defaultValue={opening?.title} />
            <Input name="department" label="Department" defaultValue={opening?.department ?? 'Sales'} />
            <Select name="employment_type" label="Type" defaultValue={opening?.employment_type ?? 'full_time'} options={TYPES} />
            <Input name="location" label="Location" defaultValue={opening?.location ?? 'Jaipur'} />
          </div>
          <Textarea name="description" label="Description" rows={4} required defaultValue={opening?.description} />
          <Textarea name="requirements" label="Requirements" rows={3} defaultValue={opening?.requirements ?? ''} />
          <input type="hidden" name="is_active" value={String(opening?.is_active ?? true)} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
