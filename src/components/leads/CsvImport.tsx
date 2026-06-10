'use client'

import { useState, useTransition } from 'react'
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { importLeads, type ImportField, type ImportResult } from '@/lib/leads/import'

interface Advisor { id: string; full_name: string }

const FIELDS: { key: ImportField; label: string; required?: boolean }[] = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'locality', label: 'Locality' },
  { key: 'requirement', label: 'Requirement / Note' },
  { key: 'configuration', label: 'Configuration (BHK)' },
  { key: 'budget_max', label: 'Budget' },
  { key: 'source', label: 'Source' },
]

/** Minimal CSV parser (handles quoted fields + commas/newlines inside quotes). */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const out: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      if (field !== '' || row.length) { row.push(field); out.push(row); row = []; field = '' }
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); out.push(row) }
  if (out.length === 0) return { headers: [], rows: [] }
  const headers = out[0].map((h) => h.trim())
  const rows = out.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const o: Record<string, string> = {}
    headers.forEach((h, idx) => { o[h] = r[idx] ?? '' })
    return o
  })
  return { headers, rows }
}

function guess(field: ImportField, headers: string[]): string {
  const want: Record<ImportField, string[]> = {
    full_name: ['name', 'full name', 'lead name', 'customer'],
    phone: ['phone', 'mobile', 'contact', 'number'],
    email: ['email', 'mail'],
    city: ['city', 'location'],
    locality: ['locality', 'area'],
    requirement: ['requirement', 'message', 'note', 'enquiry', 'remarks'],
    configuration: ['bhk', 'config', 'unit'],
    budget_max: ['budget', 'price'],
    source: ['source', 'channel'],
  }
  const lc = headers.map((h) => h.toLowerCase())
  for (const w of want[field]) {
    const idx = lc.findIndex((h) => h.includes(w))
    if (idx >= 0) return headers[idx]
  }
  return ''
}

export default function CsvImport({ advisors }: { advisors: Advisor[] }) {
  const [data, setData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({})
  const [assignTo, setAssignTo] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onFile = async (file: File) => {
    setError(null); setResult(null)
    const text = await file.text()
    const parsed = parseCsv(text)
    if (!parsed.rows.length) { setError('No data rows found in the file.'); return }
    setData(parsed)
    const m: Partial<Record<ImportField, string>> = {}
    for (const f of FIELDS) { const g = guess(f.key, parsed.headers); if (g) m[f.key] = g }
    setMapping(m)
  }

  const runImport = () => {
    setError(null)
    if (!data) return
    if (!mapping.phone) { setError('Map the Phone column to continue.'); return }
    startTransition(async () => {
      const res = await importLeads(data.rows, mapping, { assignTo: assignTo || null })
      if (res.ok) setResult(res)
      else setError(res.error ?? 'Import failed')
    })
  }

  const headerOptions = (data?.headers ?? []).map((h) => ({ value: h, label: h }))

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-10 cursor-pointer hover:border-indigo-300 transition-colors">
          <Upload size={26} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Choose a CSV file</span>
          <span className="text-xs text-slate-400">First row must be column headers</span>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </label>
        {data && (
          <p className="mt-3 text-sm text-slate-600 flex items-center gap-2">
            <FileText size={15} className="text-indigo-600" /> {data.rows.length} rows · {data.headers.length} columns detected
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {data && !result && (
        <>
          {/* Mapping */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Map columns</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FIELDS.map((f) => (
                <Select key={f.key}
                  label={f.label + (f.required ? ' *' : '')}
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                  placeholder="— skip —"
                  options={headerOptions}
                />
              ))}
            </div>
          </div>

          {/* Assignment + preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="max-w-xs">
              <Select label="Assign all to"
                value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                options={[{ value: '', label: 'Auto (assignment rules / round-robin)' },
                  ...advisors.map((a) => ({ value: a.id, label: a.full_name }))]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-slate-400 text-left">
                  {FIELDS.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className="px-2 py-1">{f.label}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <td key={f.key} className="px-2 py-1 text-slate-600 whitespace-nowrap">{r[mapping[f.key]!] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">Preview of first 5 of {data.rows.length} rows.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={runImport} loading={isPending} disabled={!mapping.phone}>
                Import {data.rows.length} Leads
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={20} className="text-green-600" />
            <h2 className="font-semibold text-slate-900">Import complete</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[['Created', result.created, 'text-green-700'], ['Duplicates', result.duplicates, 'text-amber-700'], ['Failed', result.failed, 'text-red-700']].map(([l, v, c]) => (
              <div key={l as string} className="text-center p-4 bg-slate-50 rounded-xl">
                <p className={`text-2xl font-bold ${c}`}>{v as number}</p>
                <p className="text-xs text-slate-500">{l as string}</p>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 space-y-1">
              <p className="font-medium flex items-center gap-1"><AlertTriangle size={13} /> Errors</p>
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => { setData(null); setResult(null); setMapping({}) }}>Import another</Button>
            <Button href="/leads">View Leads</Button>
          </div>
        </div>
      )}
    </div>
  )
}
