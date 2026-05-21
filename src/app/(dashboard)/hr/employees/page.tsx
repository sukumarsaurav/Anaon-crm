export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getEmployees } from '@/lib/hr/queries'
import { formatDate, formatCurrency } from '@/lib/utils'
import { ArrowLeft, User, Phone, Mail, Building2 } from 'lucide-react'

export default async function EmployeesPage() {
  const employees = await getEmployees()

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">{employees.length} active · {departments.length} departments</p>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 text-sm">
          No employees found. Create team members via Settings → Team.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {employees.map(emp => (
              <Link key={emp.id} href={`/hr/employees/${emp.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt={emp.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <User size={18} className="text-indigo-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{emp.full_name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap mt-0.5">
                    {emp.designation && <span>{emp.designation}</span>}
                    {emp.department && (
                      <span className="flex items-center gap-1"><Building2 size={11} />{emp.department}</span>
                    )}
                    {emp.employee_id && <span className="font-mono text-slate-300">{emp.employee_id}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">{emp.phone}</p>
                  {emp.joining_date && (
                    <p className="text-xs text-slate-400 mt-0.5">Since {formatDate(emp.joining_date)}</p>
                  )}
                  {emp.base_salary && (
                    <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(emp.base_salary)}/mo</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
