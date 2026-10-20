'use client'

import { useId, useRef, useState } from 'react'
import { Upload, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createUploadTarget } from '@/lib/files/actions'
import { FILES_BUCKET, MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_TYPES, type FileFolder } from '@/lib/files/storage'
import { cn } from '@/lib/utils'

interface Props {
  /** Form field that receives the URL (pasted, or /api/files/… after an upload). */
  name: string
  label?: string
  folder: FileFolder
  /** Record the file belongs to (client id, project id, …): keeps one folder per record. */
  scopeId?: string | null
  defaultValue?: string | null
  required?: boolean
  accept?: string
  placeholder?: string
  className?: string
  /** Called with the URL after a successful upload or edit. */
  onChange?: (url: string) => void
}

/**
 * A URL field with an Upload button. Uploads go straight from the browser to the private Storage
 * bucket through a one-time signed slot (no server body-size limit), then the field holds the
 * access-checked /api/files link.
 */
export default function FileUrlInput({
  name, label, folder, scopeId, defaultValue, required, accept, placeholder = 'Upload a file or paste a link', className, onChange,
}: Props) {
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue ?? '')
  const [state, setState] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) { setError('Files must be under 25 MB'); return }
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) { setError('Upload a PDF, image, Word or Excel file'); return }
    setState('uploading')
    const target = await createUploadTarget({ folder, scopeId, filename: file.name, contentType: file.type, size: file.size })
    if (!target.success) { setError(target.error); setState('idle'); return }
    const { error: upErr } = await createClient().storage.from(FILES_BUCKET)
      .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setState('idle'); return }
    setValue(target.url)
    onChange?.(target.url)
    setState('done')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        <input
          id={id} name={name} value={value} required={required} placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setState('idle'); onChange?.(e.target.value) }}
          className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={state === 'uploading'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {state === 'uploading' ? <Loader2 size={14} className="animate-spin" /> : state === 'done' ? <Check size={14} className="text-emerald-600" /> : <Upload size={14} />}
          {state === 'uploading' ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" className="hidden" accept={accept ?? ALLOWED_UPLOAD_TYPES.join(',')}
          onChange={(e) => onFile(e.target.files?.[0])} aria-label={`Upload ${label ?? 'file'}`} />
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
