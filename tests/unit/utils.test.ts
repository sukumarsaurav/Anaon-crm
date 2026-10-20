import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPhone, formatBudgetRange, formatDate, getInitials, suggestNextFollowup, computeSlaStatus, isFollowUpOverdue, waLink } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats rupees compactly', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(500)).toBe('₹500')
    expect(formatCurrency(2500)).toBe('₹3K')
    expect(formatCurrency(250000)).toBe('₹2.5L')
    expect(formatCurrency(16050000)).toBe('₹1.6Cr')
  })
  it('never prints a lakh figure of 100L or more (should roll over to crore)', () => {
    expect(formatCurrency(9999999)).not.toMatch(/^₹100\.0L$/)
  })
  it('exact mode uses Indian grouping', () => {
    expect(formatCurrency(1234567, { mode: 'exact' })).toBe('₹12,34,567')
  })
})

describe('misc formatters', () => {
  it('formatPhone', () => {
    expect(formatPhone('9810001025')).toBe('+91 98100 01025')
    expect(formatPhone('+91-9810001025')).toBe('+91 98100 01025')
    expect(formatPhone(null)).toBe('—')
  })
  it('formatBudgetRange', () => {
    expect(formatBudgetRange(null, null)).toBe('—')
    expect(formatBudgetRange(2000000, null)).toBe('From ₹20.0L')
    expect(formatBudgetRange(null, 5000000)).toBe('Up to ₹50.0L')
  })
  it('formatDate tolerates garbage', () => {
    expect(formatDate('not a date')).toBe('—')
    expect(formatDate('2026-10-20')).toBe('20 Oct 2026')
  })
  it('getInitials', () => expect(getInitials('sukumar saurav kumar')).toBe('SS'))
  it('suggestNextFollowup is in the future and shorter for callbacks', () => {
    const now = Date.now()
    expect(suggestNextFollowup('callback_requested').getTime()).toBeGreaterThan(now)
    expect(suggestNextFollowup('callback_requested').getTime()).toBeLessThan(suggestNextFollowup('connected_interested').getTime())
  })
})

describe('SLA', () => {
  const lead = (stage: string, hoursAgo: number) => ({ stage, created_at: new Date(Date.now() - hoursAgo * 3600_000).toISOString() }) as any
  it('new lead breaches after 2h', () => {
    expect(computeSlaStatus(lead('new_lead', 3)).status).toBe('breached')
    expect(computeSlaStatus(lead('new_lead', 0.1)).status).toBe('on_time')
    expect(computeSlaStatus(lead('new_lead', 1.7)).status).toBe('at_risk')
  })
  it('stages without an SLA are on time', () => {
    expect(computeSlaStatus(lead('closed_won', 9999)).status).toBe('on_time')
  })
  it('SLA is measured from when the lead entered its CURRENT stage, not from creation', () => {
    const l = { stage: 'contacted', created_at: new Date(Date.now() - 240 * 3600_000).toISOString(), stage_changed_at: new Date(Date.now() - 3600_000).toISOString() } as any
    expect(computeSlaStatus(l).status).toBe('on_time')
    expect(computeSlaStatus({ ...l, stage_changed_at: new Date(Date.now() - 30 * 3600_000).toISOString() }).status).toBe('breached')
    expect(computeSlaStatus({ ...l, stage_changed_at: null }).status).toBe('breached') // falls back to created_at
  })
  it('overdue follow-up', () => {
    expect(isFollowUpOverdue({ next_followup_at: '2020-01-01T00:00:00Z' } as any)).toBe(true)
    expect(isFollowUpOverdue({ next_followup_at: null } as any)).toBe(false)
  })
})

import { formatDateTime } from '@/lib/utils'
import { istToIso, formatInIST } from '@/lib/datetime'

describe('time zones (the CRM is for India)', () => {
  it('formats a UTC instant in IST, so server and browser agree', () => {
    expect(formatDateTime('2026-10-20T01:02:24.856Z')).toBe('20 Oct 2026, 6:32 AM')
    expect(formatDateTime('2026-10-20T18:45:00Z')).toBe('21 Oct 2026, 12:15 AM') // crosses midnight IST
    expect(formatDate('2026-10-20T20:00:00Z')).toBe('21 Oct 2026')
    expect(formatDate('2026-10-20')).toBe('20 Oct 2026') // bare dates are not shifted
  })
  it('a zone-less form date-time is IST: 7:56 PM IST is 14:26 UTC, not 19:56 UTC', () => {
    expect(istToIso('2026-10-20T19:56')).toBe('2026-10-20T14:26:00.000Z')
    expect(istToIso('2026-10-20T00:30')).toBe('2026-10-19T19:00:00.000Z')
    expect(istToIso('2026-10-20 19:56:30')).toBe('2026-10-20T14:26:30.000Z')
  })
  it('values that already carry a zone, plain dates and blanks pass through', () => {
    expect(istToIso('2026-10-20T14:26:00.000Z')).toBe('2026-10-20T14:26:00.000Z')
    expect(istToIso('2026-10-20T19:56:00+05:30')).toBe('2026-10-20T19:56:00+05:30')
    expect(istToIso('2026-10-20')).toBe('2026-10-20')
    expect(istToIso('')).toBeNull()
    expect(istToIso(null)).toBeNull()
  })
  it('formatInIST', () => {
    expect(formatInIST('2026-10-20T14:26:00Z', { hour: '2-digit', minute: '2-digit', hour12: false })).toBe('19:56')
    expect(formatInIST('garbage', {})).toBe('')
  })
})

describe('waLink', () => {
  it('adds the Indian country code to the stored phone formats', () => {
    expect(waLink('8368233575')).toBe('https://wa.me/918368233575')
    expect(waLink('+91-9876543210')).toBe('https://wa.me/919876543210')
    expect(waLink('09876543210')).toBe('https://wa.me/919876543210')
    expect(waLink('919876543210')).toBe('https://wa.me/919876543210')
  })
  it('keeps foreign numbers and encodes the prefilled text', () => {
    expect(waLink('+1 415 555 0100')).toBe('https://wa.me/14155550100')
    expect(waLink('9876543210', 'Hi, I need help')).toBe('https://wa.me/919876543210?text=Hi%2C%20I%20need%20help')
  })
})
