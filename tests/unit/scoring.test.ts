import { describe, it, expect } from 'vitest'
import { calculateLeadScore } from '@/lib/leads/scoring'

const base = { id: 'l1', created_at: '2026-10-01T10:00:00Z' } as any
const act = (type: string, extra: any = {}) => ({ type, created_at: '2026-10-01T10:30:00Z', ...extra }) as any

describe('lead scoring', () => {
  it('starts cold at 0', () => {
    expect(calculateLeadScore({ lead: base, activities: [] })).toMatchObject({ score: 0, temperature: 'cold' })
  })
  it('rewards referral/walk-in and penalises portal', () => {
    expect(calculateLeadScore({ lead: { ...base, source: 'referral' }, activities: [] }).score).toBe(15)
    expect(calculateLeadScore({ lead: { ...base, source: 'portal' }, activities: [] }).score).toBe(0) // floored
  })
  it('first contact within an hour is +15, later is not', () => {
    expect(calculateLeadScore({ lead: base, activities: [act('call')] }).score).toBe(15)
    expect(calculateLeadScore({ lead: base, activities: [act('call', { created_at: '2026-10-01T13:00:00Z' })] }).score).toBe(0)
  })
  it('stage bonuses stack: negotiation = visited(20)+5', () => {
    expect(calculateLeadScore({ lead: { ...base, stage: 'negotiation' }, activities: [] }).score).toBe(25)
    expect(calculateLeadScore({ lead: { ...base, stage: 'token_paid' }, activities: [] }).score).toBe(30)
  })
  it('three unanswered attempts subtract 10', () => {
    const acts = ['not_reachable', 'voicemail', 'not_reachable'].map((o) => act('note', { outcome: o }))
    const r = calculateLeadScore({ lead: { ...base, source: 'walk_in' }, activities: acts })
    expect(r.score).toBe(5)
  })
  it('clamps to 0..100 and maps temperature at 50 / 80', () => {
    const acts = [act('call'), act('email'), act('document_shared'), act('whatsapp', { outcome: 'connected_interested' })]
    const r = calculateLeadScore({ lead: { ...base, source: 'referral', stage: 'token_paid' }, activities: acts })
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.temperature).toBe(r.score >= 80 ? 'hot' : 'warm')
  })
  it('budget overlap with inventory scores +20, a far mismatch -15', () => {
    const ok = calculateLeadScore({ lead: { ...base, budget_min: 20, budget_max: 40 }, activities: [], projectBudgetMin: 30, projectBudgetMax: 60 })
    expect(ok.deltas.some((d) => d.delta === 20)).toBe(true)
    const bad = calculateLeadScore({ lead: { ...base, source: 'referral', budget_min: 1, budget_max: 2 }, activities: [], projectBudgetMin: 50, projectBudgetMax: 60 })
    expect(bad.deltas.some((d) => d.delta === -15)).toBe(true)
  })
})
