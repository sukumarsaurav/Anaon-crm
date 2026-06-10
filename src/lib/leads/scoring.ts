import type { LeadScoreInput, LeadTemperature } from '@/types/leads'

interface ScoreDelta {
  signal: string
  delta: number
}

export function calculateLeadScore(input: LeadScoreInput): {
  score: number
  temperature: LeadTemperature
  deltas: ScoreDelta[]
} {
  const { lead, activities, projectBudgetMin, projectBudgetMax } = input
  const deltas: ScoreDelta[] = []
  let score = 0

  // +20: budget matches available inventory
  if (
    lead.budget_min != null &&
    lead.budget_max != null &&
    projectBudgetMin != null &&
    projectBudgetMax != null
  ) {
    const overlap =
      lead.budget_max >= projectBudgetMin && lead.budget_min <= projectBudgetMax
    if (overlap) {
      deltas.push({ signal: 'Budget matches inventory', delta: 20 })
      score += 20
    } else {
      const budgetMid = (lead.budget_min + lead.budget_max) / 2
      const projectMid = (projectBudgetMin + projectBudgetMax) / 2
      const mismatchPct = Math.abs(budgetMid - projectMid) / projectMid
      if (mismatchPct > 0.5) {
        deltas.push({ signal: 'Large budget mismatch', delta: -15 })
        score -= 15
      }
    }
  }

  // +15: responded to first contact within 1 hour
  const firstCall = activities.find((a) => a.type === 'call' || a.type === 'whatsapp')
  if (firstCall && lead.created_at) {
    const createdAt = new Date(lead.created_at).getTime()
    const firstContactAt = new Date(firstCall.created_at).getTime()
    const diffHours = (firstContactAt - createdAt) / (1000 * 60 * 60)
    if (diffHours <= 1) {
      deltas.push({ signal: 'Responded within 1 hour', delta: 15 })
      score += 15
    }
  }

  // +15: high-quality source
  if (lead.source === 'referral' || lead.source === 'walk_in') {
    deltas.push({ signal: 'High-quality source (referral/walk-in)', delta: 15 })
    score += 15
  }

  // -5: low-quality source
  if (lead.source === 'portal') {
    deltas.push({ signal: 'Low-quality source (portal)', delta: -5 })
    score -= 5
  }

  // +20: has visited site
  const visitedStages = ['site_visit_done', 'negotiation', 'token_paid', 'closed_won']
  if (lead.stage && visitedStages.includes(lead.stage)) {
    deltas.push({ signal: 'Has visited site', delta: 20 })
    score += 20
  }

  // +10: replied to WhatsApp
  const whatsappReply = activities.some(
    (a) => a.type === 'whatsapp' && a.outcome === 'connected_interested'
  )
  if (whatsappReply) {
    deltas.push({ signal: 'Replied on WhatsApp', delta: 10 })
    score += 10
  }

  // +5: opened email
  const emailActivity = activities.some((a) => a.type === 'email')
  if (emailActivity) {
    deltas.push({ signal: 'Email interaction', delta: 5 })
    score += 5
  }

  // +5: viewed brochure/document
  const docShared = activities.some((a) => a.type === 'document_shared')
  if (docShared) {
    deltas.push({ signal: 'Brochure/document shared', delta: 5 })
    score += 5
  }

  // -10: multiple no-response attempts (3+)
  const noResponseCount = activities.filter(
    (a) => a.outcome === 'not_reachable' || a.outcome === 'voicemail'
  ).length
  if (noResponseCount >= 3) {
    deltas.push({ signal: `${noResponseCount} unanswered attempts`, delta: -10 })
    score -= 10
  }

  // Stage bonuses
  if (lead.stage === 'interested') {
    deltas.push({ signal: 'Confirmed interest', delta: 10 })
    score += 10
  }
  if (lead.stage === 'negotiation') {
    deltas.push({ signal: 'In negotiation', delta: 5 })
    score += 5
  }
  if (lead.stage === 'token_paid') {
    deltas.push({ signal: 'Token paid', delta: 10 })
    score += 10
  }

  const finalScore = Math.max(0, Math.min(100, score))

  const temperature: LeadTemperature =
    finalScore >= 80 ? 'hot' : finalScore >= 50 ? 'warm' : 'cold'

  return { score: finalScore, temperature, deltas }
}

export function getTemperatureLabel(temperature: LeadTemperature): string {
  return { hot: 'Hot', warm: 'Warm', cold: 'Cold' }[temperature]
}
