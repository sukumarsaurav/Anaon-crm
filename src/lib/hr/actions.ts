'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { decideLeave, leaveWorkingDates } from './leave'
import { computeSlip, monthDays, salaryStructure } from './payroll'
import { calculateCommission } from '@/lib/team/commission'
import type { IncentiveSlab } from '@/types/team'
import { istToIso } from '@/lib/datetime'
import { createStaffAccount, nextEmployeeId } from '@/lib/team/provision'
import { getTeamsData } from '@/lib/team/teams'
import { updateStaffProfile, setStaffActive } from '@/lib/team/staff'
import { MONTH_NAMES, type CandidateStage } from '@/types/hr'
import { notifyUsers } from '@/lib/notifications/notify'
import { sendEmail, emailConfigured } from '@/lib/email/client'
import { genericEmail } from '@/lib/email/templates'

async function getAuthUser(allowedRoles = ['admin', 'manager']) {
  const session = await getProfile()
  const user = session?.user
  if (!user) throw new Error('Unauthorized')
  const profile = session?.profile
  if (!profile || !allowedRoles.includes(profile.role)) throw new Error('Insufficient permissions')
  return user
}

// ── Recruitment ──────────────────────────────────────────────────────────────

/** Walk-ins, referrals and job-portal candidates: the careers form is no longer wired up. */
export async function addCandidate(formData: FormData) {
  try {
    await getAuthUser()
    const supabase = await createClient()
    const name = (formData.get('name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim()
    if (!name || !phone) return { success: false, error: 'Name and phone are required' }
    const num = (k: string) => { const v = parseFloat(formData.get(k) as string); return Number.isFinite(v) && v >= 0 ? v : null }
    const { error } = await supabase.from('career_applications').insert({
      name,
      phone,
      email: (formData.get('email') as string)?.trim() || null,
      current_company: (formData.get('current_company') as string)?.trim() || null,
      experience_years: num('experience_years'),
      expected_ctc: num('expected_ctc'),
      resume_url: (formData.get('resume_url') as string)?.trim() || null,
      cover_letter: (formData.get('notes') as string)?.trim() || null,
      stage: 'applied',
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/hr/recruitment')
    revalidatePath('/hr')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * "Joined": create the person's CRM login from their application and link the two. Before this the
 * stage changed and someone re-typed them into Team → Add junior, with nothing linking the records.
 */
export async function convertCandidateToEmployee(candidateId: string, formData: FormData) {
  try {
    const user = await getAuthUser()
    const supabase = await createClient()
    const { data: candidate } = await supabase
      .from('career_applications').select('id, name, phone, email, stage, profile_id').eq('id', candidateId).maybeSingle()
    if (!candidate) return { success: false, error: 'Candidate not found' }
    if (candidate.profile_id) return { success: false, error: 'This candidate already has a CRM login' }
    if (candidate.stage === 'rejected') return { success: false, error: 'This candidate was rejected' }

    const teams = await getTeamsData()
    if (!teams) return { success: false, error: 'Not authorized' }
    const salary = parseFloat(formData.get('base_salary') as string)
    const joining = (formData.get('joining_date') as string) || null
    if (joining && !/^\d{4}-\d{2}-\d{2}$/.test(joining)) return { success: false, error: 'Choose the joining date' }

    const res = await createStaffAccount(
      { id: user.id, role: teams.viewer.role, manageableTeamIds: teams.manageableTeamIds },
      {
        full_name: (formData.get('full_name') as string) || candidate.name,
        email: (formData.get('email') as string) || candidate.email || '',
        phone: (formData.get('phone') as string) || candidate.phone,
        role: formData.get('role') as 'manager' | 'sales_advisor' | 'telecaller',
        designation: (formData.get('designation') as string) || undefined,
        target_team_id: formData.get('team_id') as string,
        mode: 'member',
        joining_date: joining,
        base_salary: Number.isFinite(salary) ? salary : null,
        employee_id: ((formData.get('employee_id') as string) || '').trim() || await nextEmployeeId(),
        department: (formData.get('department') as string) || null,
        employment_type: (formData.get('employment_type') as string) || 'full_time',
      },
    )
    if (!res.success || !res.userId) return { success: false, error: res.error ?? 'Could not create the login' }

    const { error } = await supabase.from('career_applications').update({
      stage: 'joined', profile_id: res.userId, joining_date: joining,
      reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', candidateId)
    if (error) console.error('[hr] candidate link failed:', error.message) // the login exists; link can be retried

    revalidatePath('/hr/recruitment')
    revalidatePath('/hr/employees')
    revalidatePath('/team/teams')
    return { success: true, tempPassword: res.tempPassword, employeeId: res.userId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

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
    if (!istToIso(formData.get('interview_date') as string)) return { success: false, error: 'Choose the interview date and time' }

    const { error } = await supabase
      .from('career_applications')
      .update({
        stage: 'interview_scheduled',
        interview_date:   istToIso(formData.get('interview_date') as string),
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
        offer_date:  (formData.get('offer_date') as string) || null,
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
    await getAuthUser(['admin'])
    const supabase = await createClient()

    const year = parseInt(formData.get('year') as string)
    const month = parseInt(formData.get('month') as string)
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return { success: false, error: 'Choose a valid month and year' }
    }

    const { data: existing } = await supabase
      .from('payroll_runs').select('id').eq('year', year).eq('month', month).maybeSingle()
    if (existing) return { success: false, error: 'Payroll run already exists for this month' }

    const days = monthDays(year, month)
    const monthStart = days[0].date
    const monthEnd = days[days.length - 1].date
    const workingDates = days.filter((d) => d.working).map((d) => d.date)

    // Staff only (broker logins have profiles too). Includes people who left during the month — they
    // are owed their days — and leaves out anyone joining after it.
    const { data: staff } = await supabase
      .from('profiles')
      .select('id, full_name, role, base_salary, is_active, joining_date, termination_date')
      .in('role', ['admin', 'manager', 'sales_advisor', 'telecaller'])
      .or(`is_active.eq.true,termination_date.gte.${monthStart}`)
    const employees = (staff ?? []).filter((e) => (!e.joining_date || e.joining_date <= monthEnd)
      && (e.is_active || (e.termination_date && e.termination_date >= monthStart)))

    const noSalary = employees.filter((e) => !(Number(e.base_salary) > 0)).map((e) => e.full_name)
    const payable = employees.filter((e) => Number(e.base_salary) > 0)
    if (!payable.length) {
      return { success: false, error: noSalary.length ? `Set a base salary first (HR → Employees): ${noSalary.join(', ')}` : 'No employees to pay' }
    }
    const ids = payable.map((e) => e.id)

    // Unpaid days: approved unpaid leave and days marked absent, on working days only.
    const [{ data: unpaid }, { data: absent }] = await Promise.all([
      supabase.from('leave_requests').select('user_id, from_date, to_date')
        .eq('status', 'approved').eq('leave_type', 'unpaid').in('user_id', ids)
        .lte('from_date', monthEnd).gte('to_date', monthStart),
      supabase.from('attendance_logs').select('user_id, date')
        .eq('status', 'absent').in('user_id', ids).gte('date', monthStart).lte('date', monthEnd),
    ])
    const unpaidDates = new Map<string, Set<string>>()
    const mark = (uid: string, date: string) => {
      if (!unpaidDates.has(uid)) unpaidDates.set(uid, new Set())
      unpaidDates.get(uid)!.add(date)
    }
    for (const l of unpaid ?? []) for (const d of leaveWorkingDates(l.from_date, l.to_date)) if (d >= monthStart && d <= monthEnd) mark(l.user_id, d)
    for (const a of absent ?? []) if (workingDates.includes(a.date)) mark(a.user_id, a.date)

    // Incentives: each advisor's / telecaller's confirmed bookings this month through the incentive slabs
    // (Team → Incentives). Copied onto the slip, so a later slab change never alters a paid slip.
    const sellers = payable.filter((e) => e.role === 'sales_advisor' || e.role === 'telecaller').map((e) => e.id)
    const incentiveBy = new Map<string, number>()
    if (sellers.length) {
      const [{ data: sales }, { data: slabs }] = await Promise.all([
        supabase.from('bookings').select('advisor_id, total_sale_value')
          .in('advisor_id', sellers).eq('status', 'confirmed').gte('booking_date', monthStart).lte('booking_date', monthEnd),
        supabase.from('incentive_slabs').select('*').eq('is_active', true).order('sort_order'),
      ])
      for (const id of sellers) {
        const mine = (sales ?? []).filter((b) => b.advisor_id === id)
        if (!mine.length) continue
        const revenue = mine.reduce((t, b) => t + Number(b.total_sale_value ?? 0), 0)
        const c = calculateCommission(mine.length, revenue, (slabs ?? []) as IncentiveSlab[])
        const amount = Math.round(c.commission_amount + (c.current_slab ? c.bonus_amount : 0))
        if (amount > 0) incentiveBy.set(id, amount)
      }
    }

    const notes = [(formData.get('notes') as string) || null, incentiveBy.size ? 'Incentives pre-filled from the incentive slabs' : null].filter(Boolean).join(' · ') || null
    const { data: run, error } = await supabase
      .from('payroll_runs')
      .insert({ year, month, notes })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }

    const slips = payable.map((emp) => {
      const employed = workingDates.filter((d) => (!emp.joining_date || d >= emp.joining_date)
        && (!emp.termination_date || d <= emp.termination_date))
      const off = unpaidDates.get(emp.id) ?? new Set<string>()
      const presentDays = employed.filter((d) => !off.has(d)).length
      return {
        run_id: run.id,
        user_id: emp.id,
        ...computeSlip({ ...salaryStructure(Number(emp.base_salary)), workingDays: workingDates.length, presentDays, incentives: incentiveBy.get(emp.id) ?? 0 }),
      }
    })

    const { error: slipError } = await supabase.from('payroll_slips').insert(slips)
    if (slipError) {
      // Don't leave a run behind that claims totals for slips that were never saved.
      await supabase.from('payroll_runs').delete().eq('id', run.id)
      return { success: false, error: `Could not generate the slips: ${slipError.message}` }
    }
    await updateRunTotals(supabase, run.id, { status: 'processing' })

    revalidatePath('/hr/payroll')
    return {
      success: true,
      runId: run.id,
      warning: noSalary.length ? `No slip for ${noSalary.join(', ')} — no base salary set.` : undefined,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

async function updateRunTotals(supabase: Awaited<ReturnType<typeof createClient>>, runId: string, extra: Record<string, unknown> = {}) {
  const { data: all } = await supabase.from('payroll_slips').select('gross, total_deductions, net_pay').eq('run_id', runId)
  const totals = (all ?? []).reduce((t, r) => ({
    gross: t.gross + Number(r.gross ?? 0), deductions: t.deductions + Number(r.total_deductions ?? 0), net: t.net + Number(r.net_pay ?? 0),
  }), { gross: 0, deductions: 0, net: 0 })
  await supabase.from('payroll_runs').update({
    total_gross: totals.gross, total_deductions: totals.deductions, total_net: totals.net,
    total_employees: (all ?? []).length, updated_at: new Date().toISOString(), ...extra,
  }).eq('id', runId)
}

export async function finalizePayrollRun(runId: string, opts: { emailEmployees?: boolean } = {}) {
  try {
    const user = await getAuthUser(['admin'])
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('payroll_runs')
      .update({
        status:       'completed',
        processed_by: user.id,
        processed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', runId)
      .neq('status', 'completed')
      .select('id, year, month')
    if (error) return { success: false, error: error.message }
    if (!data?.length) return { success: false, error: 'This run is already finalized' }

    // Tell everyone their slip is ready (in-app; by email only if asked). The email carries a link,
    // never the figures.
    const run = data[0]
    const period = `${MONTH_NAMES[run.month]} ${run.year}`
    const { data: slips } = await supabase.from('payroll_slips')
      .select('user_id, employee:profiles!payroll_slips_user_id_fkey(email)').eq('run_id', runId)
    const ids = (slips ?? []).map((s) => s.user_id as string)
    await notifyUsers(ids, {
      title: `Payslip for ${period}`, message: 'Your payslip is ready to view and download.',
      type: 'system', action_url: '/team/attendance',
    })
    let emailed = 0
    if (opts.emailEmployees && emailConfigured()) {
      const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/team/attendance`
      for (const s of slips ?? []) {
        const email = ((Array.isArray(s.employee) ? s.employee[0] : s.employee) as { email?: string | null } | null)?.email
        if (!email) continue
        const tpl = genericEmail(`Your payslip for ${period}`, `Your payslip for ${period} is ready. Sign in to the CRM to view or download it:\n${link}`)
        const r = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html })
        if (r.success) emailed++
      }
    }
    revalidatePath('/hr/payroll')
    return { success: true, notified: ids.length, emailed }
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
      .select('run_id, basic, hra, allowances, working_days, run:payroll_runs!payroll_slips_run_id_fkey(status)')
      .eq('id', slipId)
      .single()
    if (!slip) return { success: false, error: 'Slip not found' }
    const runStatus = (Array.isArray(slip.run) ? slip.run[0] : slip.run as { status?: string } | null)?.status
    if (runStatus === 'completed') return { success: false, error: 'This payroll run is finalized — slips can no longer be changed' }

    const figures = computeSlip({
      basic: Number(slip.basic ?? 0), hra: Number(slip.hra ?? 0), allowances: Number(slip.allowances ?? 0),
      workingDays: parseInt(formData.get('working_days') as string) || Number(slip.working_days) || 26,
      presentDays: parseInt(formData.get('present_days') as string) || 0,
      incentives: parseFloat(formData.get('incentives') as string) || 0,
    })
    const { error } = await supabase.from('payroll_slips').update(figures).eq('id', slipId)
    if (error) return { success: false, error: error.message }

    await updateRunTotals(supabase, slip.run_id)
    revalidatePath('/hr/payroll')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
