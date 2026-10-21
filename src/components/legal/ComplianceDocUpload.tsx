'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { addProjectDocument } from '@/lib/inventory/actions'
import FileUrlInput from '@/components/ui/FileUrlInput'
import { useToast } from '@/components/ui/Toast'

interface Props {
  projectId: string
  categories: { key: string; label: string }[]
}

/** Real upload to the private bucket. It was a "paste a URL" box whose type=url rejected /api/files links. */
export default function ComplianceDocUpload({ projectId, categories }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (!(fd.get('file_url') as string)?.trim()) { setError('Upload the file first'); return }
    setError(null)
    startTransition(async () => {
      const res = await addProjectDocument(fd)
      if (!res.success) { setError(res.error ?? 'Could not save the document'); return }
      toast.success('Document added')
      setFormKey((k) => k + 1)
      router.refresh()
    })
  }

  const cls = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500'
  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="project_id" value={projectId} />
      <input aria-label="Document name" name="name" placeholder="Document name" required className={cls} />
      <select aria-label="Document category" name="category" required className={cls}>
        {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <FileUrlInput name="file_url" folder="legal" scopeId={projectId} required accept=".pdf,image/*" />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={pending}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
        <Upload size={11} /> {pending ? 'Saving…' : 'Add document'}
      </button>
    </form>
  )
}
