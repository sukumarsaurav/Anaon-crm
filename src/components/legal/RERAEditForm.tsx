'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProjectRERA, markQuarterlyReportSubmitted } from '@/lib/legal/actions'

interface RERAData {
  rera_number: string | null
  rera_registration_date: string | null
  rera_expiry_date: string | null
  rera_authority_name: string | null
  rera_website_url: string | null
  legal_contact: string | null
  carpet_area_sqft: number | null
  fsi_approved: number | null
  total_approved_units: number | null
  quarterly_report_last_submitted: string | null
  quarterly_report_due_date: string | null
  rera_disclosures?: Record<string, string> | null
}

interface Props { projectId: string; data: RERAData }

export default function RERAEditForm({ projectId, data }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [markingReport, setMarkingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProjectRERA(projectId, fd)
      setLoading(false)
      if (result.success) { setSuccess(true); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  function handleMarkReport() {
    setMarkingReport(true)
    startTransition(async () => {
      await markQuarterlyReportSubmitted(projectId)
      setMarkingReport(false)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* RERA Registration */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">RERA Registration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reraeditform-rera-number" className="block text-xs font-medium text-slate-600 mb-1">RERA Number <span className="text-red-500">*</span></label>
            <input id="reraeditform-rera-number" name="rera_number" defaultValue={data.rera_number ?? ''} placeholder="RAJ/P/2024/001234"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="reraeditform-rera-authority-name" className="block text-xs font-medium text-slate-600 mb-1">State RERA Authority</label>
            <input id="reraeditform-rera-authority-name" name="rera_authority_name" defaultValue={data.rera_authority_name ?? ''} placeholder="e.g. Rajasthan RERA"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="reraeditform-rera-registration-date" className="block text-xs font-medium text-slate-600 mb-1">Registration Date</label>
            <input id="reraeditform-rera-registration-date" type="date" name="rera_registration_date" defaultValue={data.rera_registration_date ?? ''}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="reraeditform-rera-expiry-date" className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
            <input id="reraeditform-rera-expiry-date" type="date" name="rera_expiry_date" defaultValue={data.rera_expiry_date ?? ''}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="reraeditform-rera-website-url" className="block text-xs font-medium text-slate-600 mb-1">RERA Portal URL</label>
            <input id="reraeditform-rera-website-url" type="url" name="rera_website_url" defaultValue={data.rera_website_url ?? ''} placeholder="https://rera.rajasthan.gov.in/project/..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      {/* Mandated Disclosures */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">RERA-Mandated Disclosures</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="reraeditform-carpet-area-sqft" className="block text-xs font-medium text-slate-600 mb-1">Carpet Area (sqft)</label>
            <input id="reraeditform-carpet-area-sqft" type="number" name="carpet_area_sqft" defaultValue={data.carpet_area_sqft ?? ''} placeholder="1200"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="reraeditform-fsi-approved" className="block text-xs font-medium text-slate-600 mb-1">FSI Approved</label>
            <input id="reraeditform-fsi-approved" type="number" step="0.01" name="fsi_approved" defaultValue={data.fsi_approved ?? ''} placeholder="2.5"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label htmlFor="reraeditform-total-approved-units" className="block text-xs font-medium text-slate-600 mb-1">Total Approved Units</label>
            <input id="reraeditform-total-approved-units" type="number" name="total_approved_units" defaultValue={data.total_approved_units ?? ''} placeholder="150"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      {/* Quarterly reports */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Quarterly Progress Report</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reraeditform-quarterly-report-due-date" className="block text-xs font-medium text-slate-600 mb-1">Next Report Due Date</label>
            <input id="reraeditform-quarterly-report-due-date" type="date" name="quarterly_report_due_date" defaultValue={data.quarterly_report_due_date ?? ''}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex flex-col justify-end">
            {data.quarterly_report_last_submitted && (
              <p className="text-xs text-slate-500 mb-2">Last submitted: {data.quarterly_report_last_submitted}</p>
            )}
            <button type="button" onClick={handleMarkReport} disabled={markingReport}
              className="px-3 py-2 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50">
              {markingReport ? 'Marking...' : 'Mark Report Submitted (sets the next quarter’s due date)'}
            </button>
          </div>
        </div>
      </div>

      {/* Disclosures */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Other Disclosures</h3>
        {data.rera_disclosures && Object.keys(data.rera_disclosures).length > 0 && (
          <dl className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(data.rera_disclosures).map(([k, v]) => (
              <div key={k} className="flex gap-2"><dt className="text-slate-500">{k}:</dt><dd className="text-slate-800">{v}</dd></div>
            ))}
          </dl>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input aria-label="Disclosure name" name="disclosure_key" placeholder="e.g. Open area %"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <input aria-label="Disclosure value" name="disclosure_value" placeholder="e.g. 35%"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <p className="text-xs text-slate-500 mt-1">Adds or updates one disclosure each time you save.</p>
      </div>

      {/* Legal contact */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Legal Contact</h3>
        <input aria-label="Adv. Sharma — +91 98765 43210" name="legal_contact" defaultValue={data.legal_contact ?? ''} placeholder="Adv. Sharma — +91 98765 43210"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">RERA details saved successfully.</p>}

      <button type="submit" disabled={loading}
        className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
        {loading ? 'Saving...' : 'Save RERA Details'}
      </button>
    </form>
  )
}
