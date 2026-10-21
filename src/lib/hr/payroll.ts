/**
 * Payslip arithmetic, shared by "Generate payroll" and "Adjust slip" so the two can't drift.
 * Plain module — not a server action.
 *
 * Structure: basic 50%, HRA 20%, allowances the rest of the monthly base salary. Pay is for the days
 * worked out of the month's working days (Sundays off); unpaid days (before joining, after leaving,
 * approved unpaid leave, days marked absent) reduce it.
 */

/** Monthly professional tax. Depends on the state of employment — confirm the rate with your CA. */
export const PROFESSIONAL_TAX_MONTHLY = 200
/** Employee PF: 12% of basic, on basic up to the statutory wage ceiling. */
export const PF_RATE = 0.12
export const PF_WAGE_CEILING = 15_000

export interface SlipFigures {
  basic: number
  hra: number
  allowances: number
  gross: number
  pf_employee: number
  pf_employer: number
  professional_tax: number
  total_deductions: number
  net_pay: number
  working_days: number
  present_days: number
  lop_days: number
  incentives: number
}

/** `basic`, `hra`, `allowances` are the full-month structure; the paid amounts scale with days. */
export function computeSlip(input: {
  basic: number
  hra: number
  allowances: number
  workingDays: number
  presentDays: number
  incentives?: number
}): SlipFigures {
  const workingDays = Math.max(1, Math.round(input.workingDays))
  const presentDays = Math.min(workingDays, Math.max(0, Math.round(input.presentDays)))
  const ratio = presentDays / workingDays
  const incentives = Math.max(0, Number(input.incentives ?? 0))
  const structure = input.basic + input.hra + input.allowances
  const earned = Math.round(structure * ratio)
  const earnedBasic = Math.round(input.basic * ratio)
  const pf = Math.round(Math.min(earnedBasic, PF_WAGE_CEILING) * PF_RATE)
  const pt = earned > 0 ? PROFESSIONAL_TAX_MONTHLY : 0
  const gross = earned + incentives
  const deductions = pf + pt
  return {
    basic: input.basic,
    hra: input.hra,
    allowances: input.allowances,
    gross,
    pf_employee: pf,
    pf_employer: pf,
    professional_tax: pt,
    total_deductions: deductions,
    net_pay: Math.max(0, gross - deductions),
    working_days: workingDays,
    present_days: presentDays,
    lop_days: workingDays - presentDays,
    incentives,
  }
}

export function salaryStructure(base: number): { basic: number; hra: number; allowances: number } {
  const basic = Math.round(base * 0.5)
  const hra = Math.round(base * 0.2)
  return { basic, hra, allowances: base - basic - hra }
}

/** Every date of the month as "YYYY-MM-DD", and which are working days (not Sunday). */
export function monthDays(year: number, month: number): { date: string; working: boolean }[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1, i + 1))
    return { date: d.toISOString().slice(0, 10), working: d.getUTCDay() !== 0 }
  })
}
