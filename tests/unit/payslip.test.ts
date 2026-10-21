import { describe, it, expect } from 'vitest'
import React from 'react'
import { writeFileSync } from 'node:fs'
import { renderToBuffer } from '@react-pdf/renderer'
import { PayslipDoc } from '@/lib/pdf/documents'
import { amountInWords, rupeesInWords } from '@/lib/hr/amountInWords'
import { buildBankCsv, splitPayable } from '@/lib/hr/bankExport'

describe('amount in words (Indian numbering)', () => {
  it('handles lakh and crore', () => {
    expect(amountInWords(0)).toBe('Zero')
    expect(amountInWords(40000)).toBe('Forty Thousand')
    expect(amountInWords(123456)).toBe('One Lakh Twenty-Three Thousand Four Hundred Fifty-Six')
    expect(amountInWords(12_34_56_789)).toBe('Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine')
    expect(rupeesInWords(38000.4)).toBe('Rupees Thirty-Eight Thousand Only')
  })
})

describe('payslip PDF', () => {
  it('renders', async () => {
    const buf = await renderToBuffer(React.createElement(PayslipDoc, { data: {
      period: 'October 2026',
      slip: { working_days: 27, present_days: 26, lop_days: 1, basic: 20000, hra: 8000, allowances: 12000, incentives: 5000, gross: 43519,
        pf_employee: 1800, professional_tax: 200, tds: null, total_deductions: 2000, net_pay: 41519 },
      employee: { full_name: 'Asha Verma', employee_id: 'EMP-0007', designation: 'Sales Advisor', department: 'Sales', joining_date: '2026-01-05',
        pan: null, bank_name: 'HDFC Bank', bank_account: null, bank_ifsc: 'HDFC0001234' },
      netInWords: rupeesInWords(41519),
    } }) as never)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    if (process.env.PAYSLIP_OUT) writeFileSync(process.env.PAYSLIP_OUT, buf)
  })
})

describe('bank transfer file', () => {
  it('holds back bad bank details and escapes cells', () => {
    const { ok, missing } = splitPayable([
      { name: 'A, Kumar', account: '1234 5678 9012', ifsc: 'hdfc0001234', amount: 38000, email: null, employeeId: 'EMP-1' },
      { name: 'B', account: null, ifsc: 'HDFC0001234', amount: 20000, email: null, employeeId: 'EMP-2' },
      { name: 'C', account: '123456789012', ifsc: 'BAD', amount: 10000, email: null, employeeId: 'EMP-3' },
      { name: '=cmd', account: '123456789012', ifsc: 'SBIN0001234', amount: 5000, email: null, employeeId: null },
      { name: 'Zero', account: null, ifsc: null, amount: 0, email: null, employeeId: null },
    ])
    expect(missing.map((m) => m.name)).toEqual(['B', 'C'])
    const csv = buildBankCsv('generic', ok, 'SALARY OCT 2026')
    expect(csv.split('\r\n')[1]).toBe('"A, Kumar",123456789012,HDFC0001234,38000.00,SALARY OCT 2026 EMP-1,')
    expect(csv).toContain(`"'=cmd"`)
  })
})
