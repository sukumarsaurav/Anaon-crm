export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getEmployeeById, getEmployees } from '@/lib/hr/queries'
import EmployeeForm from '@/components/hr/EmployeeForm'
import ActionButton from '@/components/ui/ActionButton'
import { deactivateEmployee } from '@/lib/hr/actions'

export const metadata = { title: 'Employee' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = await params
  const [employee, allEmployees] = await Promise.all([
    getEmployeeById(id),
    getEmployees(),
  ])
  if (!employee) notFound()

  async function deactivate(reason?: string) {
    'use server'
    return deactivateEmployee(id, reason ?? '')
  }

  const managers = allEmployees.map(e => ({ id: e.id, full_name: e.full_name }))

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/employees" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{employee.full_name}</h1>
          <p className="text-sm text-slate-500">
            {employee.designation}{employee.department && ` · ${employee.department}`}
            {employee.employee_id && ` · ${employee.employee_id}`}
          </p>
        </div>
        {employee.is_active ? (
          <div className="ml-auto">
            <ActionButton label="Deactivate employee" tone="danger"
              promptLabel="Reason for deactivating (recorded as the termination reason):"
              action={deactivate} />
          </div>
        ) : (
          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">Inactive</span>
        )}
      </div>
      <EmployeeForm employee={employee} managers={managers} />
    </div>
  )
}
