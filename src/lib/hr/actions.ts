'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { decideLeave } from './leave'
import { updateStaffProfile, setStaffActive } from '@/lib/team/staff'
import type { CandidateStage } from '@/types/hr'

async function getAuthUser(allowedRoles = ['admin', 'manager']) {
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

// Both go through lib/team/staff.ts: profiles can only be updated by their owner under RLS, so
// writing here with the signed-in client changed nothing and still returned success.
export async function updateEmployee(employeeId: string, formData: FormData) {
  return updateStaffProfile(employeeId, formData)
}

export async function deactivateEmployee(employeeId: string, reason: string) {
  return setStaffActive(employeeId, false, reason)
}

export async function reactivateEmployee(employeeId: string) {
  return setStaffActive(employeeId, true)
}

// ── Leave Management ──────────────────────────────────────────────────────────

export async function approveLeave(leaveId: string, note?: string) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()
    const r = await decideLeave(supabase, { leaveId, reviewerId: user.id, approve: true, note })
    if (r.success) revalidatePath('/hr/leaves')
    return r
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function rejectLeave(leaveId: string, note: string) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()
    const r = await decideLeave(supabase, { leaveId, reviewerId: user.id, approve: false, note })
    if (r.success) revalidatePath('/hr/leaves')
    return r
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Entitlement for one leave type in a year. `used` is maintained by leave approval and kept. */
export async function setLeaveBalance(formData: FormData) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const userId = formData.get('user_id') as string
    const leaveType = formData.get('leave_type') as string
    const year = parseInt(formData.get('year') as string) || new Date().getFullYear()
    const entitled = parseInt(formData.get('entitled') as string)
    if (!userId || !leaveType) return { success: false, error: 'Choose an employee and a leave type' }
    if (!Number.isInteger(entitled) || entitled < 0 || entitled > 366) return { success: false, error: 'Enter the number of days (0–366)' }

    const { data: existing } = await supabase
      .from('hr_leave_balances').select('id').eq('user_id', userId).eq('year', year).eq('leave_type', leaveType).maybeSingle()
    const { error } = existing
      ? await supabase.from('hr_leave_balances').update({ entitled, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('hr_leave_balances').insert({ user_id: userId, year, leave_type: leaveType, entitled, used: 0 })
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
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return { success: false, error: 'Choose a valid month and year' }
    }

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
      // Staff only: broker logins have profiles too and must not appear on the payroll.
      .in('role', ['admin', 'manager', 'sales_advisor', 'telecaller'])

    if (employees && employees.length > 0) {
      // Approved UNPAID leave in this month is loss of pay. (Every slip was 26/26 days, so unpaid
      // leave never reduced anyone's pay unless an admin edited each slip by hand.)
      const monthStart = new Date(Date.UTC(year, month - 1, 1))
      const monthEnd = new Date(Date.UTC(year, month, 0))
      const { data: unpaid } = await supabase
        .from('leave_requests')
        .select('user_id, from_date, to_date')
        .eq('status', 'approved')
        .eq('leave_type', 'unpaid')
        .lte('from_date', monthEnd.toISOString().slice(0, 10))
        .gte('to_date', monthStart.toISOString().slice(0, 10))
      const lopByUser = new Map<string, number>()
      for (const l of unpaid ?? []) {
        const from = Math.max(Date.parse(`${l.from_date}T00:00:00Z`), monthStart.getTime())
        const to = Math.min(Date.parse(`${l.to_date}T00:00:00Z`), monthEnd.getTime())
        const days = Math.max(0, Math.round((to - from) / 86_400_000) + 1)
        lopByUser.set(l.user_id, (lopByUser.get(l.user_id) ?? 0) + days)
      }

      const slips = employees.map(emp => {
        const base = Number(emp.base_salary ?? 0)
        const basic = Math.round(base * 0.5)
        const hra = Math.round(base * 0.2)
        const allowances = base - basic - hra
        const gross = base
        const pf = Math.round(basic * 0.12)
        const prof_tax = 200
        const workingDays = 26
        const lop = Math.min(lopByUser.get(emp.id) ?? 0, workingDays)
        const lopDeduction = lop > 0 ? Math.round((gross / workingDays) * lop) : 0
        const total_deductions = pf + prof_tax
        const net = gross - lopDeduction - total_deductions

        return {
          run_id: run.id,
          user_id: emp.id,
          working_days: workingDays,
          present_days: workingDays - lop,
          lop_days: lop,
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

      const { error: slipError } = await supabase.from('payroll_slips').insert(slips)
      if (slipError) {
        // Don't leave a run behind that claims totals for slips that were never saved.
        await supabase.from('payroll_runs').delete().eq('id', run.id)
        return { success: false, error: `Could not generate the slips: ${slipError.message}` }
      }

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

/**
 * Adjust one slip of a run that is not finalized: present days (loss of pay) and incentives.
 * Recomputed from the salary structure each time — it used to start from the stored figures, so
 * every re-edit deducted the loss of pay again.
 */
export async function updatePayrollSlip(slipId: string, formData: FormData) {
  try {
    await getAuthUser(['admin'])
    const supabase = await createClient()

    const { data: slip } = await supabase
      .from('payroll_slips')
      .select('run_id, basic, hra, allowances, total_deductions, run:payroll_runs!payroll_slips_run_id_fkey(status)')
      .eq('id', slipId)
      .single()
    if (!slip) return { success: false, error: 'Slip not found' }
    const runStatus = (Array.isArray(slip.run) ? slip.run[0] : slip.run as { status?: string } | null)?.status
    if (runStatus === 'completed') return { success: false, error: 'This payroll run is finalized — slips can no longer be changed' }

    const workingDays = parseInt(formData.get('working_days') as string) || 26
    const presentDays = Math.min(workingDays, Math.max(0, parseInt(formData.get('present_days') as string) || 0))
    const lopDays = workingDays - presentDays
    const incentives = Math.max(0, parseFloat(formData.get('incentives') as string) || 0)

    const structure = Number(slip.basic ?? 0) + Number(slip.hra ?? 0) + Number(slip.allowances ?? 0)
    const lopDeduction = lopDays > 0 ? Math.round((structure / workingDays) * lopDays) : 0
    const gross = Math.max(0, structure - lopDeduction + incentives)
    const netPay = Math.max(0, gross - Number(slip.total_deductions ?? 0))

    const { error } = await supabase
      .from('payroll_slips')
      .update({ present_days: presentDays, working_days: workingDays, lop_days: lopDays, incentives, gross, net_pay: netPay })
      .eq('id', slipId)
    if (error) return { success: false, error: error.message }

    // Keep the run totals in step with its slips.
    const { data: all } = await supabase.from('payroll_slips').select('gross, total_deductions, net_pay').eq('run_id', slip.run_id)
    const totals = (all ?? []).reduce((t, r) => ({
      gross: t.gross + Number(r.gross ?? 0), deductions: t.deductions + Number(r.total_deductions ?? 0), net: t.net + Number(r.net_pay ?? 0),
    }), { gross: 0, deductions: 0, net: 0 })
    await supabase.from('payroll_runs').update({
      total_gross: totals.gross, total_deductions: totals.deductions, total_net: totals.net, updated_at: new Date().toISOString(),
    }).eq('id', slip.run_id)

    revalidatePath('/hr/payroll')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
