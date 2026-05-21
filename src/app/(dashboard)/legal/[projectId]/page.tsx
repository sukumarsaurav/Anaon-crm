export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProjectRERADetail } from '@/lib/legal/queries'
import { RERA_CHECKLIST_ITEMS } from '@/types/legal'
import { DOCUMENT_CATEGORY_LABELS } from '@/types/inventory'
import RERAEditForm from '@/components/legal/RERAEditForm'
async function uploadDoc(fd: FormData) { 'use server'; const { addProjectDocument } = await import('@/lib/inventory/actions'); await addProjectDocument(fd) }
import { ChevronLeft, CheckCircle2, XCircle, AlertTriangle, Upload, ExternalLink, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props { params: Promise<{ projectId: string }> }

export default async function ProjectRERAPage({ params }: Props) {
  const { projectId } = await params
  const { project, documents } = await getProjectRERADetail(projectId)

  if (!project) notFound()

  const now = new Date()
  const uploadedCategories = new Set(documents.map((d: any) => d.category))

  let daysUntilExpiry: number | null = null
  if (project.rera_expiry_date) {
    daysUntilExpiry = Math.floor((new Date(project.rera_expiry_date).getTime() - now.getTime()) / 86400000)
  }

  const quarterlyDue = project.quarterly_report_due_date && new Date(project.quarterly_report_due_date) <= now

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/legal" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">RERA compliance &amp; legal documents</p>
        </div>
      </div>

      {/* Alerts */}
      {(daysUntilExpiry !== null && daysUntilExpiry <= 60 || quarterlyDue) && (
        <div className="space-y-2">
          {daysUntilExpiry !== null && daysUntilExpiry <= 60 && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
              daysUntilExpiry <= 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <AlertTriangle size={15} className="shrink-0" />
              {daysUntilExpiry <= 0
                ? `RERA registration expired ${Math.abs(daysUntilExpiry)} days ago — renew immediately`
                : `RERA expiring in ${daysUntilExpiry} days — initiate renewal`}
            </div>
          )}
          {quarterlyDue && (
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-700 text-sm">
              <Clock size={15} className="shrink-0" />
              Quarterly progress report overdue — submit to RERA authority
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* RERA edit form — 3 cols */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 mb-5">RERA Registration Details</h2>
          <RERAEditForm projectId={projectId} data={project as any} />
        </div>

        {/* Compliance checklist — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Document Compliance</h2>
            <div className="space-y-3">
              {RERA_CHECKLIST_ITEMS.map(item => {
                const uploaded = uploadedCategories.has(item.key)
                return (
                  <div key={item.key} className="flex items-center gap-3">
                    {uploaded
                      ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      : <XCircle size={16} className={item.required ? 'text-red-400 shrink-0' : 'text-slate-300 shrink-0'} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-snug">{item.label}</p>
                      {item.required && !uploaded && (
                        <p className="text-xs text-red-500">Required</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Upload doc form */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-2">Upload a document</p>
              <form action={uploadDoc}>
                <input type="hidden" name="project_id" value={projectId} />
                <div className="space-y-2">
                  <input name="name" placeholder="Document name" required
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select name="category" required
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {RERA_CHECKLIST_ITEMS.map(item => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                  <input type="url" name="file_url" placeholder="File URL (uploaded to storage)" required
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                    <Upload size={11} /> Upload Document
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* RERA link */}
          {project.rera_website_url && (
            <a href={project.rera_website_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-sm hover:bg-indigo-100">
              <ExternalLink size={14} />
              View on RERA Portal
            </a>
          )}
        </div>
      </div>

      {/* Uploaded documents */}
      {documents.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Uploaded Documents</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Uploaded</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc: any) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{doc.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {DOCUMENT_CATEGORY_LABELS[doc.category as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? doc.category}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline">View</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
