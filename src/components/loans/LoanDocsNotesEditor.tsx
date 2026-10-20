'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { updateLoanDocs, updateLoanNotes } from '@/lib/loans/actions'
import { LOAN_DOC_CHECKLIST } from '@/types/loans'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'

type DocKey = (typeof LOAN_DOC_CHECKLIST)[number]['key']

interface Props {
  loanId: string
  docs: Record<DocKey, boolean | null>
  notes: string | null
}

/** Tick the bank's document checklist and keep notes. Both were read-only before. */
export function LoanDocsEditor({ loanId, docs }: Omit<Props, 'notes'>) {
  const router = useRouter()
  const [state, setState] = useState(() => Object.fromEntries(LOAN_DOC_CHECKLIST.map((d) => [d.key, !!docs[d.key]])) as Record<DocKey, boolean>)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(key: DocKey) {
    const next = { ...state, [key]: !state[key] }
    setState(next)
    const fd = new FormData()
    for (const d of LOAN_DOC_CHECKLIST) fd.set(d.key, String(next[d.key]))
    setError(null)
    startTransition(async () => {
      const res = await updateLoanDocs(loanId, fd)
      if (!res.success) { setError(res.error ?? 'Could not save'); setState(state) }
      else router.refresh()
    })
  }

  const done = LOAN_DOC_CHECKLIST.filter((d) => state[d.key]).length
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Document Checklist</h2>
        <span className="text-xs text-slate-500">{done}/{LOAN_DOC_CHECKLIST.length} submitted</span>
      </div>
      <div className="space-y-1">
        {LOAN_DOC_CHECKLIST.map((doc) => (
          <button key={doc.key} type="button" onClick={() => toggle(doc.key)} disabled={pending}
            aria-pressed={state[doc.key]}
            className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-60">
            {state[doc.key]
              ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
              : <XCircle size={15} className="text-slate-300 shrink-0" />}
            <span className={`text-sm ${state[doc.key] ? 'text-slate-700' : 'text-slate-400'}`}>{doc.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">Click a document to mark it received or missing.</p>
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export function LoanNotesEditor({ loanId, notes }: Pick<Props, 'loanId' | 'notes'>) {
  const router = useRouter()
  const [value, setValue] = useState(notes ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const dirty = value !== (notes ?? '')

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
      <Textarea label="Notes" rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" loading={pending} onClick={() => startTransition(async () => {
            setError(null)
            const res = await updateLoanNotes(loanId, value.trim())
            if (!res.success) setError(res.error ?? 'Could not save')
            else router.refresh()
          })}>Save notes</Button>
        </div>
      )}
    </div>
  )
}
