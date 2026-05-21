export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getEmployeeById, getEmployees } from '@/lib/hr/queries'
import EmployeeForm from '@/components/hr/EmployeeForm'

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
      </div>
      <EmployeeForm employee={employee} managers={managers} />
    </div>
  )
}
