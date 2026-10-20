import { describe, it, expect } from 'vitest'
import { todayIST, istDayStart, istDayBounds, istWeekStart } from '@/lib/datetime'
import { searchOr } from '@/lib/supabase/search'

describe('IST calendar helpers', () => {
  // 2026-10-20 01:00 IST is still 2026-10-19 in UTC: the window the old code got wrong.
  const earlyMorning = new Date('2026-10-19T19:30:00Z')
  const evening = new Date('2026-10-20T13:00:00Z') // 18:30 IST

  it('todayIST is the Indian date, not the UTC date', () => {
    expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-10-19')
    expect(todayIST(earlyMorning)).toBe('2026-10-20')
    expect(todayIST(evening)).toBe('2026-10-20')
  })

  it('istDayStart is IST midnight (18:30 UTC the previous day), with day offsets', () => {
    expect(istDayStart(earlyMorning).toISOString()).toBe('2026-10-19T18:30:00.000Z')
    expect(istDayStart(evening).toISOString()).toBe('2026-10-19T18:30:00.000Z')
    expect(istDayStart(evening, 1).toISOString()).toBe('2026-10-20T18:30:00.000Z')
    expect(istDayStart(evening, -29).toISOString()).toBe('2026-09-20T18:30:00.000Z')
  })

  it('istDayBounds spans exactly one IST day', () => {
    const { start, end } = istDayBounds(evening)
    expect(end.getTime() - start.getTime()).toBe(86_400_000)
    expect(evening >= start && evening < end).toBe(true)
  })

  it('istWeekStart is the Sunday in IST', () => {
    // Tuesday 20 Oct 2026 → Sunday 18 Oct, 00:00 IST
    expect(istWeekStart(evening).toISOString()).toBe('2026-10-17T18:30:00.000Z')
    // 00:30 IST on Sunday 25 Oct is still Saturday in UTC, but the IST week has started
    expect(istWeekStart(new Date('2026-10-24T19:00:00Z')).toISOString()).toBe('2026-10-24T18:30:00.000Z')
  })
})

describe('searchOr', () => {
  it('returns null for an empty term', () => {
    expect(searchOr('', { text: ['full_name'] })).toBeNull()
    expect(searchOr('   ', { text: ['full_name'] })).toBeNull()
    expect(searchOr(undefined, { text: ['full_name'] })).toBeNull()
  })

  it('quotes values so commas and parentheses are literal', () => {
    expect(searchOr('Sharma, Rahul', { text: ['full_name', 'email'] }))
      .toBe('full_name.ilike."%Sharma, Rahul%",email.ilike."%Sharma, Rahul%"')
    expect(searchOr('a) or (b', { text: ['name'] })).toBe('name.ilike."%a) or (b%"')
  })

  it('escapes quotes and backslashes inside the value', () => {
    expect(searchOr('say "hi" \\o/', { text: ['name'] })).toBe('name.ilike."%say \\"hi\\" \\\\o/%"')
  })

  it('matches phones on digits so spaced or +91 input finds stored numbers', () => {
    const cols = { text: ['full_name'], phone: ['phone'] }
    expect(searchOr('98765 43210', cols)).toBe('full_name.ilike."%98765 43210%",phone.ilike."%9876543210%"')
    expect(searchOr('+91 98765-43210', cols)).toContain('phone.ilike."%9876543210%"')
    // A name is searched as typed in the phone column too (harmless, keeps one code path)
    expect(searchOr('Ravi', cols)).toBe('full_name.ilike."%Ravi%",phone.ilike."%Ravi%"')
  })
})
