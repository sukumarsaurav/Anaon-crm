import { describe, it, expect } from 'vitest'
import { toWhatsAppNumber, lastTenDigits } from '@/lib/whatsapp/phone'
import { renderTemplate, namedVariables, toPositionalBody, sampleValueFor } from '@/lib/whatsapp/template-render'
import { fillTemplateVariables } from '@/lib/whatsapp/variables'
import { validateTemplateButtons, normalizeTemplateButtons } from '@/lib/whatsapp/template-buttons'

describe('phone numbers', () => {
  it('adds 91 to bare Indian mobiles (a bare 10-digit goes to Iran otherwise)', () => {
    expect(toWhatsAppNumber('9810001025')).toBe('919810001025')
    expect(toWhatsAppNumber('+91-98100 01025')).toBe('919810001025')
    expect(toWhatsAppNumber('09810001025')).toBe('919810001025')
    expect(toWhatsAppNumber('919810001025')).toBe('919810001025')
  })
  it('rejects junk', () => {
    expect(toWhatsAppNumber('12345')).toBeNull()
    expect(toWhatsAppNumber(null)).toBeNull()
    expect(toWhatsAppNumber('')).toBeNull()
  })
  it('lastTenDigits', () => {
    expect(lastTenDigits('+91-98100 01025')).toBe('9810001025')
    expect(lastTenDigits('12345')).toBeNull()
  })
})

describe('template rendering', () => {
  it('fills named and positional placeholders', () => {
    expect(renderTemplate('Hi {{name}}, see {{project}}', ['name', 'project'], { name: 'Ravi', project: 'Greens' })).toBe('Hi Ravi, see Greens')
    expect(renderTemplate('Hi {{1}} / {{2}}', ['a', 'b'], { a: 'X', b: 'Y' })).toBe('Hi X / Y')
  })
  it('marks missing values instead of leaving blanks', () => {
    expect(renderTemplate('Hi {{name}}', ['name'], {})).toBe('Hi [name]')
  })
  it('a value containing a placeholder is not expanded again', () => {
    expect(renderTemplate('{{1}} then {{2}}', ['a', 'b'], { a: '{{2}}', b: 'B' })).toBe('{{2}} then B')
  })
  it('namedVariables keeps first-appearance order and dedupes', () => {
    expect(namedVariables('{{ b }} {{a}} {{b}}')).toEqual(['b', 'a'])
  })
  it('toPositionalBody converts names to {{n}}', () => {
    expect(toPositionalBody('Hi {{name}} {{ project }}', ['name', 'project'])).toBe('Hi {{1}} {{2}}')
  })
  it('sample values look real', () => {
    expect(sampleValueFor('Customer name')).toBe('Rahul')
    expect(sampleValueFor('project_name')).toBe('ANON Greens')
  })
})

describe('fillTemplateVariables (meaning-based matching)', () => {
  const ctx = { name: 'Ravi', project: 'ANON Greens', advisor_name: 'Priya', advisor_phone: '9999999999', amount: '50,000', due_date: '25 Oct', date: '26 Oct', time: '11 AM', booking_no: 'BK-1', unit: 'A-12', link: 'https://x.in' }
  it('maps common labels', () => {
    const { values, missing } = fillTemplateVariables(['Customer name', 'Project', 'Advisor name', 'Advisor phone', 'amount', 'due date', 'time', 'booking number', 'plot', 'link'], ctx)
    expect(missing).toEqual([])
    expect(values).toEqual(['Ravi', 'ANON Greens', 'Priya', '9999999999', '50,000', '25 Oct', '11 AM', 'BK-1', 'A-12', 'https://x.in'])
  })
  it('{{1}} on an unlabelled template is the customer name', () => {
    expect(fillTemplateVariables(['1'], ctx).values).toEqual(['Ravi'])
  })
  it('reports variables nothing can fill', () => {
    expect(fillTemplateVariables(['mystery'], ctx).missing).toEqual(['mystery'])
  })
  // Substring matching bugs: these words CONTAIN another keyword.
  it('"first name" is a name, not an amount ("rs" is inside "first")', () => {
    expect(fillTemplateVariables(['first name'], ctx).values).toEqual(['Ravi'])
  })
  it('"payment terms" is not the advisor ("rm" is inside "terms")', () => {
    expect(fillTemplateVariables(['payment terms'], ctx).missing).toEqual(['payment terms'])
  })
  it('"confirmation code" is not the advisor ("rm" is inside "confirmation")', () => {
    expect(fillTemplateVariables(['confirmation code'], ctx).missing).toEqual(['confirmation code'])
  })
  it('"website link" is the link, not the project ("site" is inside "website")', () => {
    expect(fillTemplateVariables(['website link'], ctx).values).toEqual(['https://x.in'])
  })
  it('overrides win', () => {
    expect(fillTemplateVariables(['name'], { ...ctx, overrides: { name: 'Override' } }).values).toEqual(['Override'])
  })
})

describe('template buttons', () => {
  it('accepts valid buttons', () => {
    expect(validateTemplateButtons([{ type: 'URL', text: 'Open', url: 'https://anonindia.com' }, { type: 'PHONE_NUMBER', text: 'Call', phone_number: '+91 98765-43210' }, { type: 'QUICK_REPLY', text: 'Stop promotions' }] as any)).toBeNull()
  })
  it('enforces limits and formats', () => {
    expect(validateTemplateButtons([{ type: 'URL', text: 'A', url: 'http://x.in' }] as any)).toMatch(/https/)
    expect(validateTemplateButtons([{ type: 'URL', text: 'A', url: 'https://x.in/{{1}}' }] as any)).toMatch(/variables/)
    expect(validateTemplateButtons([{ type: 'PHONE_NUMBER', text: 'Call', phone_number: '12345' }] as any)).toMatch(/country code/)
    expect(validateTemplateButtons([{ type: 'QUICK_REPLY', text: 'x'.repeat(26) }] as any)).toMatch(/25/)
    expect(validateTemplateButtons([{ type: 'QUICK_REPLY', text: '' }] as any)).toMatch(/label/)
    expect(validateTemplateButtons(Array(3).fill({ type: 'URL', text: 'A', url: 'https://x.in' }) as any)).toMatch(/2 website/)
  })
  it('normalizes', () => {
    expect(normalizeTemplateButtons([{ type: 'PHONE_NUMBER', text: ' Call ', phone_number: '+91 98765-43210' }] as any)).toEqual([{ type: 'PHONE_NUMBER', text: 'Call', phone_number: '+919876543210' }])
  })
})
