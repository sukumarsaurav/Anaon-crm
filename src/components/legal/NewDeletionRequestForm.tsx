'use client'

import { useRef, useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitDeletionRequest, searchErasureSubjects } from '@/lib/legal/actions'
import { Plus, X, Search } from 'lucide-react'

type Subject = { id: string; full_name: string; phone: string | null; email: string | null }

const fieldCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

/**
 * Logs a DPDP erasure request against a specific lead or client. The form used to take only a name,
 * so no request was ever linked to a record and "Mark completed" could never erase anything.
 */
export default function NewDeletionRequestForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<'lead' | 'client'>('lead')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Subject[]>([])
  const [subject, setSubject] = useState<Subject | null>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  function search(nextTerm: string, nextType = type) {
    setTerm(nextTerm)
    if (timer.current) clearTimeout(timer.current)
    if (nextTerm.trim().length < 2) { setResults([]); return }
    const mine = ++seq.current
    timer.current = setTimeout(async () => {
      const r = await searchErasureSubjects(nextType, nextTerm)
      if (mine === seq.current) setResults(r) // ignore answers to older keystrokes
    }, 250)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!subject) { setError(`Find and select the ${type} first`); return }
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('requester_id', subject.id)
    startTransition(async () => {
      const result = await submitDeletionRequest(fd)
      setLoading(false)
      if (result.success) { setOpen(false); setSubject(null); setTerm(''); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700">
        <Plus size={15} /> New Request
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Log Data Deletion Request</h3>
        <button onClick={() => setOpen(false)} aria-label="Close"><X size={16} className="text-slate-400" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="newdeletionrequestform-requester-type" className="block text-xs font-medium text-slate-600 mb-1">Requester Type</label>
            <select id="newdeletionrequestform-requester-type" name="requester_type" required value={type}
              onChange={(e) => { const t = e.target.value as 'lead' | 'client'; setType(t); setSubject(null); search(term, t) }}
              className={fieldCls}>
              <option value="lead">Lead (Prospect)</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div className="relative">
            <label htmlFor="newdeletionrequestform-subject" className="block text-xs font-medium text-slate-600 mb-1">
              Find the {type} <span className="text-red-500">*</span>
            </label>
            {subject ? (
              <div className="flex items-center justify-between gap-2 border border-primary-200 bg-primary-50 rounded-lg px-3 py-2 text-sm">
                <span className="truncate">{subject.full_name}{subject.phone ? ` · ${subject.phone}` : ''}</span>
                <button type="button" onClick={() => setSubject(null)} className="text-xs text-primary-700 hover:underline">Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="newdeletionrequestform-subject" value={term} onChange={(e) => search(e.target.value)}
                    placeholder="Name, phone or email" autoComplete="off" className={`${fieldCls} pl-8`} />
                </div>
                {results.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-sm max-h-56 overflow-auto">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => { setSubject(r); setResults([]) }}>
                          <span className="font-medium text-slate-900">{r.full_name}</span>
                          <span className="text-xs text-slate-500"> {r.phone ?? ''} {r.email ?? ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div>
            <label htmlFor="newdeletionrequestform-requester-name" className="block text-xs font-medium text-slate-600 mb-1">Requester name <span className="text-red-500">*</span></label>
            <input id="newdeletionrequestform-requester-name" name="requester_name" required placeholder="Who made the request"
              key={subject?.id ?? 'none'} defaultValue={subject?.full_name ?? ''} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="newdeletionrequestform-requester-phone" className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input id="newdeletionrequestform-requester-phone" type="tel" name="requester_phone" placeholder="+91 98765 43210"
              key={`p-${subject?.id ?? 'none'}`} defaultValue={subject?.phone ?? ''} className={fieldCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="newdeletionrequestform-requester-email" className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input id="newdeletionrequestform-requester-email" type="email" name="requester_email" placeholder="email@example.com"
              key={`e-${subject?.id ?? 'none'}`} defaultValue={subject?.email ?? ''} className={fieldCls} />
          </div>
        </div>
        <div>
          <label htmlFor="newdeletionrequestform-reason" className="block text-xs font-medium text-slate-600 mb-1">Reason for deletion</label>
          <textarea id="newdeletionrequestform-reason" name="reason" rows={2} placeholder="No longer interested / withdrawal of consent..."
            className={`${fieldCls} resize-none`} />
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Submit Request'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
