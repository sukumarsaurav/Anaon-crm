import { createClient } from '@/lib/supabase/server'
import type { Candidate, HREmployee, LeaveRequest, LeaveBalance, AttendanceLog, PayrollRun, PayrollSlip } from '@/types/hr'

export async function getCandidates(stage?: string): Promise<Candidate[]> {
  const supabase = await createClient()
  let q = supabase
    .from('career_applications')
    .select('*, listing:career_listings(title), interviewer:profiles!career_applications_interviewer_id_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (stage) q = q.eq('stage', stage)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Candidate[]
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('career_applications')
    .select('*, listing:career_listings(title), interviewer:profiles!career_applications_interviewer_id_fkey(full_name)')
    .eq('id', id)
    .single()
  return data as Candidate | null
}

export async function getEmployees(): Promise<HREmployee[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*, manager:profiles!profiles_reporting_manager_id_fkey(full_name)')
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return (data ?? []) as HREmployee[]
}

export async function getEmployeeById(id: string): Promise<HREmployee | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*, manager:profiles!profiles_reporting_manager_id_fkey(full_name)')
    .eq('id', id)
    .single()
  return data as HREmployee | null
}

export async function getLeaveRequests(status?: string): Promise<LeaveRequest[]> {
  const supabase = await createClient()
  let q = supabase
    .from('leave_requests')
    .select('*, employee:profiles!leave_requests_user_id_fkey(full_name, designation, photo_url), reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as LeaveRequest[]
}

export async function getLeaveBalances(userId?: string): Promise<LeaveBalance[]> {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  let q = supabase
    .from('hr_leave_balances')
    .select('*, employee:profiles!hr_leave_balances_user_id_fkey(full_name)')
    .eq('year', year)
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
  return (data ?? []) as LeaveBalance[]
}

export async function getAttendanceLogs(date?: string, userId?: string): Promise<AttendanceLog[]> {
  const supabase = await createClient()
  const target = date ?? new Date().toISOString().split('T')[0]
  let q = supabase
    .from('attendance_logs')
    .select('*, employee:profiles!attendance_logs_user_id_fkey(full_name, designation)')
    .eq('date', target)
    .order('check_in_at', { ascending: false })
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
  return (data ?? []) as AttendanceLog[]
}

export async function getPayrollRuns(): Promise<PayrollRun[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*, processor:profiles!payroll_runs_processed_by_fkey(full_name)')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return (data ?? []) as PayrollRun[]
}

export async function getPayrollSlips(runId: string): Promise<PayrollSlip[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_slips')
    .select('*, employee:profiles!payroll_slips_user_id_fkey(full_name, designation, employee_id)')
    .eq('run_id', runId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as PayrollSlip[]
}

export async function getHRStats() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const [employees, candidates, pendingLeaves, todayAttendance] = await Promise.all([
    supabase.from('profiles').select('id, is_active, joining_date').eq('is_active', true),
    supabase.from('career_applications').select('id, stage'),
    supabase.from('leave_requests').select('id').eq('status', 'pending'),
    supabase.from('attendance_logs').select('id, status').eq('date', today),
  ])

  const active = (employees.data ?? []).length
  const openPositions = (candidates.data ?? []).filter(c => !['joined', 'rejected'].includes(c.stage)).length
  const pending = (pendingLeaves.data ?? []).length
  const todayPresent = (todayAttendance.data ?? []).filter(a => a.status === 'present').length

  return { active, openPositions, pending, todayPresent }
}
