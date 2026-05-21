export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getLegalDocumentTemplates } from '@/lib/legal/queries'
import { LEGAL_DOCUMENT_TYPE_LABELS, LEGAL_DOCUMENT_TYPES, type LegalDocumentType } from '@/types/legal'
import LegalTemplateForm from '@/components/legal/LegalTemplateForm'
import { ChevronLeft, FileText, Download, CheckCircle2, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const TYPE_ORDER = LEGAL_DOCUMENT_TYPES

export default async function LegalDocumentsPage() {
  const templates = await getLegalDocumentTemplates()

  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = templates.filter(t => t.type === type)
    return acc
  }, {} as Record<LegalDocumentType, typeof templates>)

  const totalActive = templates.filter(t => t.is_active).length

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/legal" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Legal Document Templates</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {totalActive} active templates · pre-configured RERA-compliant formats
            </p>
          </div>
        </div>
        <LegalTemplateForm />
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <FileText size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No templates yet</p>
          <p className="text-xs text-slate-400 mt-1">Add booking forms, ATS, allotment letters, and more</p>
        </div>
      ) : (
        <div className="space-y-6">
          {TYPE_ORDER.map(type => {
            const items = grouped[type] ?? []
            if (!items.length) return null
            return (
              <div key={type}>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {LEGAL_DOCUMENT_TYPE_LABELS[type]}
                </h2>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {items.map(tpl => (
                    <div key={tpl.id} className="flex items-start gap-4 px-4 py-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        tpl.is_active ? 'bg-indigo-50' : 'bg-slate-100'
                      }`}>
                        <FileText size={15} className={tpl.is_active ? 'text-indigo-600' : 'text-slate-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-slate-900 text-sm">{tpl.name}</p>
                          <span className="text-xs text-slate-400">v{tpl.version}</span>
                          {tpl.is_active
                            ? <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded">Active</span>
                            : <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">Inactive</span>}
                        </div>
                        {tpl.description && <p className="text-xs text-slate-500">{tpl.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">Added {formatDate(tpl.created_at)}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {tpl.file_url ? (
                          <a href={tpl.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">
                            <Download size={12} /> Download
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 px-3 py-1.5">No file</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* RERA compliance note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">RERA Compliance Note</p>
        <ul className="text-xs space-y-1 text-blue-700 list-disc list-inside">
          <li>Agreement to Sale (ATS) must be in RERA-prescribed format for the relevant state</li>
          <li>ATS must be registered within 30 days of execution (Registration Act, 1908)</li>
          <li>All marketing material must display RERA registration number</li>
          <li>Cancellation conditions must adhere to RERA Section 11 & 12</li>
        </ul>
      </div>
    </div>
  )
}
