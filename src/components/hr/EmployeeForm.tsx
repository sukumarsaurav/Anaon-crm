'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEmployee } from '@/lib/hr/actions'
import type { HREmployee } from '@/types/hr'

interface Props {
  employee: HREmployee
  managers: { id: string; full_name: string }[]
  /** Managers can't change pay, bank or login fields (the server refuses too). */
  payLocked?: boolean
}

export default function EmployeeForm({ employee, managers, payLocked = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateEmployee(employee.id, formData)
      setLoading(false)
      if (!result.success) setError(result.error ?? 'Failed to update')
      else { setSuccess(true); router.refresh() }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Personal Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employeeform-full-name" className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input id="employeeform-full-name" name="full_name" required defaultValue={employee.full_name ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-phone" className="block text-sm font-medium text-slate-700 mb-1">Phone <span className="text-red-500">*</span></label>
            <input id="employeeform-phone" name="phone" required defaultValue={employee.phone ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input id="employeeform-email" name="email" disabled={payLocked} title={payLocked ? 'Only an admin can change this' : undefined} type="email" defaultValue={employee.email ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-aadhar-number" className="block text-sm font-medium text-slate-700 mb-1">Aadhar Number</label>
            <input id="employeeform-aadhar-number" name="aadhar_number" inputMode="numeric" pattern="[0-9 ]{12,14}" title="12-digit Aadhaar number" defaultValue={employee.aadhar_number ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-pan-number" className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
            <input id="employeeform-pan-number" name="pan_number" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" title="PAN like ABCDE1234F" defaultValue={employee.pan_number ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-emergency-contact" className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact</label>
            <input id="employeeform-emergency-contact" name="emergency_contact" placeholder="Name – Phone"
              defaultValue={employee.emergency_contact ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="employeeform-address" className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <textarea id="employeeform-address" name="address" rows={2} defaultValue={employee.address ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
        </div>
      </div>

      {/* Employment */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Employment Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employeeform-employee-id" className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
            <input id="employeeform-employee-id" name="employee_id" defaultValue={employee.employee_id ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-designation" className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
            <input id="employeeform-designation" name="designation" defaultValue={employee.designation ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-department" className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <input id="employeeform-department" name="department" defaultValue={employee.department ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-employment-type" className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
            <select id="employeeform-employment-type" name="employment_type" defaultValue={employee.employment_type ?? 'full_time'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </div>
          <div>
            <label htmlFor="employeeform-joining-date" className="block text-sm font-medium text-slate-700 mb-1">Joining Date</label>
            <input id="employeeform-joining-date" name="joining_date" type="date" defaultValue={employee.joining_date ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-probation-end-date" className="block text-sm font-medium text-slate-700 mb-1">Probation End Date</label>
            <input id="employeeform-probation-end-date" name="probation_end_date" type="date" defaultValue={employee.probation_end_date ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-reporting-manager-id" className="block text-sm font-medium text-slate-700 mb-1">Reporting Manager</label>
            <select id="employeeform-reporting-manager-id" name="reporting_manager_id" defaultValue={employee.reporting_manager_id ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400">
              <option value="">No manager</option>
              {managers.filter(m => m.id !== employee.id).map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="employeeform-base-salary" className="block text-sm font-medium text-slate-700 mb-1">Monthly Base Salary (₹)</label>
            <input id="employeeform-base-salary" name="base_salary" disabled={payLocked} title={payLocked ? 'Only an admin can change this' : undefined} type="number" min="0" defaultValue={employee.base_salary ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Bank Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employeeform-bank-name" className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
            <input id="employeeform-bank-name" name="bank_name" disabled={payLocked} title={payLocked ? 'Only an admin can change this' : undefined} defaultValue={employee.bank_name ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-bank-account" className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
            <input id="employeeform-bank-account" name="bank_account" disabled={payLocked} title={payLocked ? 'Only an admin can change this' : undefined} defaultValue={employee.bank_account ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label htmlFor="employeeform-bank-ifsc" className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
            <input id="employeeform-bank-ifsc" name="bank_ifsc" pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" disabled={payLocked} title={payLocked ? 'Only an admin can change this' : undefined} defaultValue={employee.bank_ifsc ?? ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">Profile updated successfully.</p>}

      <button type="submit" disabled={loading}
        className="w-full py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50">
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  )
}
