'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import type { CandidateStage } from '@/types/hr'

async function getAuthUser(allowedRoles = ['admin', 'manager', 'hr']) {
  const session = await getProfile()
  const user = session?.user
  if (!user) throw new Error('Unauthorized')
  const profile = session?.profile
  if (!profile || !allowedRoles.includes(profile.role)) throw new Error('Insufficient permissions')
  return user
}

// ── Recruitment ──────────────────────────────────────────────────────────────

export async function updateCandidateStage(candidateId: string, stage: CandidateStage, formData?: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const updates: Record<string, unknown> = {
      stage,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (stage === 'rejected' && formData) {
      updates.rejection_reason = formData.get('rejection_reason') as string
    }

    const { error } = await supabase
      .from('career_applications')
      .update(updates)
      .eq('id', candidateId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/recruitment')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function scheduleInterview(candidateId: string, formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const { error } = await supabase
      .from('career_applications')
      .update({
        stage: 'interview_scheduled',
        interview_date:   formData.get('interview_date') as string,
        interviewer_id:   (formData.get('interviewer_id') as string) || null,
        interview_mode:   formData.get('interview_mode') as string,
        reviewed_by:      user.id,
        reviewed_at:      new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', candidateId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/recruitment')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function submitInterviewFeedback(candidateId: string, formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const rating = parseInt(formData.get('interview_rating') as string)
    const recommended = formData.get('recommendation') === 'yes'

    const { error } = await supabase
      .from('career_applications')
      .update({
        stage: 'interview_done',
        interview_rating:   rating || null,
        interview_feedback: formData.get('interview_feedback') as string,
        reviewed_by:        user.id,
        reviewed_at:        new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .eq('id', candidateId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/recruitment')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function makeOffer(candidateId: string, formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const { error } = await supabase
      .from('career_applications')
      .update({
        stage:       'offer',
        offer_ctc:   parseFloat(formData.get('offer_ctc') as string) || null,
        offer_date:  formData.get('offer_date') as string,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('id', candidateId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/recruitment')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Employee Records ──────────────────────────────────────────────────────────

export async function updateEmployee(employeeId: string, formData: FormData) {
  try {
    await getAuthUser()
    const supabase = await createClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:              formData.get('full_name') as string,
        phone:                  formData.get('phone') as string,
        email:                  (formData.get('email') as string) || null,
        designation:            (formData.get('designation') as string) || null,
        department:             (formData.get('department') as string) || null,
        employment_type:        (formData.get('employment_type') as string) || null,
        joining_date:           (formData.get('joining_date') as string) || null,
        probation_end_date:     (formData.get('probation_end_date') as string) || null,
        reporting_manager_id:   (formData.get('reporting_manager_id') as string) || null,
        base_salary:            parseFloat(formData.get('base_salary') as string) || null,
        employee_id:            (formData.get('employee_id') as string) || null,
        aadhar_number:          (formData.get('aadhar_number') as string) || null,
        pan_number:             (formData.get('pan_number') as string) || null,
        bank_name:              (formData.get('bank_name') as string) || null,
        bank_account:           (formData.get('bank_account') as string) || null,
        bank_ifsc:              (formData.get('bank_ifsc') as string) || null,
        emergency_contact:      (formData.get('emergency_contact') as string) || null,
        address:                (formData.get('address') as string) || null,
        updated_at:             new Date().toISOString(),
      })
      .eq('id', employeeId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/employees')
    revalidatePath(`/hr/employees/${employeeId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deactivateEmployee(employeeId: string, reason: string) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        is_active:           false,
        termination_date:    new Date().toISOString().split('T')[0],
        termination_reason:  reason,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', employeeId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/employees')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Leave Management ──────────────────────────────────────────────────────────

export async function approveLeave(leaveId: string, note?: string) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()

    const { data: leave } = await supabase
      .from('leave_requests')
      .select('user_id, leave_type, days_count')
      .eq('id', leaveId)
      .single()

    if (!leave) return { success: false, error: 'Leave request not found' }

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status:       'approved',
        reviewed_by:  user.id,
        reviewed_at:  new Date().toISOString(),
        review_note:  note ?? null,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', leaveId)
    if (error) return { success: false, error: error.message }

    // Update leave balance
    const year = new Date().getFullYear()
    // Best-effort: update leave balance used count
    try {
      await supabase.from('hr_leave_balances')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', leave.user_id)
        .eq('year', year)
        .eq('leave_type', leave.leave_type)
    } catch { /* non-critical */ }

    revalidatePath('/hr/leaves')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function rejectLeave(leaveId: string, note: string) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status:       'rejected',
        reviewed_by:  user.id,
        reviewed_at:  new Date().toISOString(),
        review_note:  note,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', leaveId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/leaves')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setLeaveBalance(formData: FormData) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const year = new Date().getFullYear()

    const { error } = await supabase
      .from('hr_leave_balances')
      .upsert({
        user_id:    formData.get('user_id') as string,
        year,
        leave_type: formData.get('leave_type') as string,
        entitled:   parseInt(formData.get('entitled') as string) || 0,
        used:       parseInt(formData.get('used') as string) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,year,leave_type' })
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/leaves')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export async function createPayrollRun(formData: FormData) {
  try {
    const user = await getAuthUser(['admin'])
    const supabase = await createClient()

    const year = parseInt(formData.get('year') as string)
    const month = parseInt(formData.get('month') as string)

    // Prevent duplicate
    const { data: existing } = await supabase
      .from('payroll_runs')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .single()
    if (existing) return { success: false, error: 'Payroll run already exists for this month' }

    const { data: run, error } = await supabase
      .from('payroll_runs')
      .insert({ year, month, notes: (formData.get('notes') as string) || null })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }

    // Auto-generate slips for all active employees
    const { data: employees } = await supabase
      .from('profiles')
      .select('id, base_salary')
      .eq('is_active', true)

    if (employees && employees.length > 0) {
      const slips = employees.map(emp => {
        const base = Number(emp.base_salary ?? 0)
        const basic = Math.round(base * 0.5)
        const hra = Math.round(base * 0.2)
        const allowances = base - basic - hra
        const gross = base
        const pf = Math.round(basic * 0.12)
        const prof_tax = 200
        const total_deductions = pf + prof_tax
        const net = gross - total_deductions

        return {
          run_id: run.id,
          user_id: emp.id,
          working_days: 26,
          present_days: 26,
          lop_days: 0,
          basic,
          hra,
          allowances,
          gross,
          pf_employee: pf,
          pf_employer: pf,
          professional_tax: prof_tax,
          total_deductions,
          net_pay: Math.max(0, net),
        }
      })

      await supabase.from('payroll_slips').insert(slips)

      // Update run totals
      const totals = slips.reduce((acc, s) => ({
        gross: acc.gross + s.gross,
        deductions: acc.deductions + s.total_deductions,
        net: acc.net + s.net_pay,
      }), { gross: 0, deductions: 0, net: 0 })

      await supabase.from('payroll_runs').update({
        total_gross: totals.gross,
        total_deductions: totals.deductions,
        total_net: totals.net,
        total_employees: employees.length,
        status: 'processing',
      }).eq('id', run.id)
    }

    revalidatePath('/hr/payroll')
    return { success: true, runId: run.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function finalizePayrollRun(runId: string) {
  try {
    const user = await getAuthUser(['admin'])
    const supabase = await createClient()
    const { error } = await supabase
      .from('payroll_runs')
      .update({
        status:       'completed',
        processed_by: user.id,
        processed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', runId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/payroll')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updatePayrollSlip(slipId: string, formData: FormData) {
  try {
    await getAuthUser(['admin'])
    const supabase = await createClient()

    const presentDays = parseInt(formData.get('present_days') as string) || 0
    const workingDays = parseInt(formData.get('working_days') as string) || 26
    const lopDays = workingDays - presentDays
    const incentives = parseFloat(formData.get('incentives') as string) || 0

    const { data: slip } = await supabase
      .from('payroll_slips')
      .select('gross, total_deductions')
      .eq('id', slipId)
      .single()

    if (!slip) return { success: false, error: 'Slip not found' }

    const lopDeduction = lopDays > 0 ? Math.round((slip.gross / workingDays) * lopDays) : 0
    const adjustedGross = Math.max(0, slip.gross - lopDeduction + incentives)
    const netPay = Math.max(0, adjustedGross - slip.total_deductions)

    const { error } = await supabase
      .from('payroll_slips')
      .update({
        present_days: presentDays,
        working_days: workingDays,
        lop_days: lopDays,
        incentives,
        net_pay: netPay,
      })
      .eq('id', slipId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/payroll')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
