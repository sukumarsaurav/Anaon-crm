'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { addCandidate } from '@/lib/hr/actions'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import FileUrlInput from '@/components/ui/FileUrlInput'
import { useToast } from '@/components/ui/Toast'

/** Manual entry for walk-ins, referrals and job-portal candidates. */
export default function AddCandidateForm() {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await addCandidate(fd)
      if (!res.success) { setError(res.error ?? 'Could not add the candidate'); return }
      toast.success('Candidate added')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add candidate</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add candidate">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input name="name" label="Name" required />
            <Input name="phone" label="Phone" required inputMode="tel" />
            <Input name="email" label="Email" type="email" />
            <Input name="current_company" label="Current company" />
            <Input name="experience_years" label="Experience (years)" type="number" min="0" step="0.5" />
            <Input name="expected_ctc" label="Expected CTC (₹/year)" type="number" min="0" />
          </div>
          <FileUrlInput name="resume_url" label="Resume" folder="hr" accept=".pdf,.doc,.docx" />
          <Textarea name="notes" label="Notes" rows={2} placeholder="Source, role applied for…" />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Add candidate</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
